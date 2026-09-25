use super::file::{write_atomic, Versioned};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

// Single owner of one JSON file: callers mutate memory, flushes write it out.
pub struct StoreHandle<T> {
    path: PathBuf,
    schema_version: u32,
    state: Mutex<T>,
    dirty: AtomicBool,
}

impl<T: Serialize + Send + 'static> StoreHandle<T> {
    pub fn new(path: PathBuf, schema_version: u32, initial: T) -> Arc<Self> {
        Arc::new(Self {
            path,
            schema_version,
            state: Mutex::new(initial),
            dirty: AtomicBool::new(false),
        })
    }

    // Forces the next flush to write, e.g. after loading a migrated file.
    pub fn mark_dirty(&self) {
        self.dirty.store(true, Ordering::Release);
    }

    // Applies `f` and writes the file in one step; any failure restores the previous state.
    pub async fn commit<R>(&self, f: impl FnOnce(&mut T) -> Result<R, String>) -> Result<R, String>
    where
        T: Clone,
    {
        let mut state = self.state.lock().await;
        let before = state.clone();
        let out = match f(&mut state) {
            Ok(out) => out,
            Err(e) => {
                *state = before;
                return Err(e);
            }
        };
        let file = Versioned {
            schema_version: self.schema_version,
            data: &*state,
        };
        let written = serde_json::to_vec_pretty(&file)
            .map_err(|e| format!("serialize: {e}"))
            .and_then(|bytes| write_atomic(&self.path, &bytes));
        if let Err(e) = written {
            *state = before;
            return Err(e);
        }
        self.dirty.store(false, Ordering::Release);
        Ok(out)
    }

    pub async fn update<R>(&self, f: impl FnOnce(&mut T) -> R) -> R {
        let mut state = self.state.lock().await;
        let out = f(&mut state);
        self.dirty.store(true, Ordering::Release);
        out
    }

    // Read-only view; never marks the file dirty.
    pub async fn read<R>(&self, f: impl FnOnce(&T) -> R) -> R {
        f(&*self.state.lock().await)
    }

    // Writes the state if it changed since the last flush; true when a write happened.
    pub async fn flush(&self) -> Result<bool, String> {
        let state = self.state.lock().await;
        if !self.dirty.swap(false, Ordering::AcqRel) {
            return Ok(false);
        }
        let file = Versioned {
            schema_version: self.schema_version,
            data: &*state,
        };
        let bytes = serde_json::to_vec_pretty(&file).map_err(|e| format!("serialize: {e}"))?;
        write_atomic(&self.path, &bytes).inspect_err(|_| {
            self.dirty.store(true, Ordering::Release);
        })?;
        Ok(true)
    }

    // Flushes dirty state every `every`; the caller keeps the handle to stop it.
    pub fn spawn_autosave(
        self: Arc<Self>,
        every: Duration,
    ) -> tauri::async_runtime::JoinHandle<()> {
        tauri::async_runtime::spawn(async move {
            let mut tick = tokio::time::interval(every);
            tick.tick().await;
            loop {
                tick.tick().await;
                if let Err(e) = self.flush().await {
                    log::error!("[store] autosave {}: {e}", self.path.display());
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::file::read_with_recovery;
    use crate::store::file::tests::scratch;

    #[tokio::test]
    async fn concurrent_updates_all_land_in_one_flush() {
        let dir = scratch("writer");
        let path = dir.join("library.json");
        let store = StoreHandle::new(path.clone(), 1, Vec::<u32>::new());
        let tasks: Vec<_> = (0..100u32)
            .map(|i| {
                let s = store.clone();
                tokio::spawn(async move { s.update(|v| v.push(i)).await })
            })
            .collect();
        for t in tasks {
            t.await.unwrap();
        }
        assert!(store.flush().await.unwrap());
        let saved: Versioned<Vec<u32>> = read_with_recovery(&path).unwrap().unwrap();
        let mut got = saved.data;
        got.sort_unstable();
        assert_eq!(got, (0..100).collect::<Vec<_>>());
        assert_eq!(saved.schema_version, 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn flush_without_changes_writes_nothing() {
        let dir = scratch("clean");
        let path = dir.join("library.json");
        let store = StoreHandle::new(path.clone(), 1, vec![1u32]);
        assert!(!store.flush().await.unwrap());
        assert!(!path.exists());
        store.update(|v| v.push(2)).await;
        assert!(store.flush().await.unwrap());
        assert!(!store.flush().await.unwrap());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn autosave_flushes_dirty_state_after_the_debounce() {
        let dir = scratch("autosave");
        let path = dir.join("library.json");
        let store = StoreHandle::new(path.clone(), 1, Vec::<u32>::new());
        let task = store.clone().spawn_autosave(Duration::from_millis(200));
        store.update(|v| v.push(7)).await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        assert!(!path.exists());
        tokio::time::sleep(Duration::from_millis(600)).await;
        task.abort();
        let saved: Versioned<Vec<u32>> = read_with_recovery(&path).unwrap().unwrap();
        assert_eq!(saved.data, vec![7]);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn commit_applies_the_change_and_writes_it() {
        let dir = scratch("commit-ok");
        let path = dir.join("x.json");
        let store = StoreHandle::new(path.clone(), 1, vec![1u32]);
        let len = store
            .commit(|v| {
                v.push(2);
                Ok(v.len())
            })
            .await
            .unwrap();
        assert_eq!(len, 2);
        let saved: Versioned<Vec<u32>> = read_with_recovery(&path).unwrap().unwrap();
        assert_eq!(saved.data, vec![1, 2]);
        assert!(!store.flush().await.unwrap());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_failed_commit_write_restores_the_previous_state() {
        let dir = scratch("commit-write-fail");
        let path = dir.join("missing").join("x.json");
        let store = StoreHandle::new(path.clone(), 1, vec![1u32]);
        store
            .commit(|v| {
                v.push(2);
                Ok(())
            })
            .await
            .unwrap_err();
        assert_eq!(store.read(Clone::clone).await, vec![1]);
        assert!(!store.flush().await.unwrap());
        assert!(!path.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_commit_whose_closure_fails_changes_nothing() {
        let dir = scratch("commit-closure-fail");
        let path = dir.join("x.json");
        let store = StoreHandle::new(path.clone(), 1, vec![1u32]);
        let err = store
            .commit::<()>(|v| {
                v.push(2);
                Err("no".into())
            })
            .await
            .unwrap_err();
        assert_eq!(err, "no");
        assert_eq!(store.read(Clone::clone).await, vec![1]);
        assert!(!store.flush().await.unwrap());
        assert!(!path.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn mark_dirty_makes_the_next_flush_write() {
        let dir = scratch("mark-dirty");
        let path = dir.join("x.json");
        let store = StoreHandle::new(path.clone(), 1, vec![1u32]);
        store.mark_dirty();
        assert!(store.flush().await.unwrap());
        assert!(path.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
