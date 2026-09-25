use super::http::OFFLINE_PREFIX;
use crate::store::file::{read_with_recovery, write_atomic, Versioned};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const GENRES_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
pub const PAGE_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_STALE: Duration = Duration::from_secs(30 * 24 * 60 * 60);
const MAX_ENTRIES: usize = 160;
const SCHEMA_VERSION: u32 = 1;

static DISK: OnceLock<DiskCache> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Entry {
    saved_at: u64,
    value: Value,
}

type Entries = HashMap<String, Entry>;

// Persisted catalog responses so a cold start without network still has something to show.
pub struct DiskCache {
    path: PathBuf,
    max_entries: usize,
    entries: Arc<Mutex<Entries>>,
    write_lock: Arc<Mutex<()>>,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

// A clock that went backwards makes an entry stale, never fresh.
fn is_fresh(saved_at: u64, now: u64, ttl: Duration) -> bool {
    saved_at <= now && now - saved_at < ttl.as_secs()
}

fn is_servable_stale(saved_at: u64, now: u64) -> bool {
    now.saturating_sub(saved_at) < MAX_STALE.as_secs()
}

fn evict_oldest(entries: &mut Entries, max_entries: usize) {
    while entries.len() > max_entries {
        let Some(oldest) = entries
            .iter()
            .min_by_key(|(_, e)| e.saved_at)
            .map(|(k, _)| k.clone())
        else {
            return;
        };
        entries.remove(&oldest);
    }
}

impl DiskCache {
    // A missing or unreadable file starts an empty cache; it is throwaway data.
    pub fn open(path: PathBuf, max_entries: usize) -> Self {
        let entries = match read_with_recovery::<Entries>(&path) {
            Ok(Some(v)) if v.schema_version == SCHEMA_VERSION => v.data,
            Ok(Some(v)) => {
                log::warn!("[cache] schema {} ignored", v.schema_version);
                Entries::new()
            }
            Ok(None) => Entries::new(),
            Err(e) => {
                log::warn!("[cache] {e}; starting empty");
                Entries::new()
            }
        };
        Self {
            path,
            max_entries,
            entries: Arc::new(Mutex::new(entries)),
            write_lock: Arc::new(Mutex::new(())),
        }
    }

    pub async fn get_or_fetch<T, F, Fut>(
        &self,
        key: &str,
        ttl: Duration,
        fetch: F,
    ) -> Result<T, String>
    where
        T: Serialize + DeserializeOwned,
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T, String>>,
    {
        let now = now_secs();
        let cached = lock(&self.entries).get(key).cloned();
        if let Some(entry) = cached.as_ref().filter(|e| is_fresh(e.saved_at, now, ttl)) {
            if let Ok(v) = serde_json::from_value(entry.value.clone()) {
                return Ok(v);
            }
        }
        match fetch().await {
            Ok(v) => {
                self.store(key, &v, now_secs()).await;
                Ok(v)
            }
            Err(e) if e.starts_with(OFFLINE_PREFIX) => {
                let stale = cached
                    .filter(|entry| is_servable_stale(entry.saved_at, now))
                    .and_then(|entry| serde_json::from_value(entry.value).ok());
                match stale {
                    Some(v) => {
                        log::info!("[cache] offline; serving stale {key}");
                        Ok(v)
                    }
                    None => Err(e),
                }
            }
            Err(e) => Err(e),
        }
    }

    async fn store<T: Serialize>(&self, key: &str, value: &T, saved_at: u64) {
        let Ok(value) = serde_json::to_value(value) else {
            return;
        };
        {
            let mut entries = lock(&self.entries);
            entries.insert(key.to_string(), Entry { saved_at, value });
            evict_oldest(&mut entries, self.max_entries);
        }
        let (path, entries, write_lock) = (
            self.path.clone(),
            self.entries.clone(),
            self.write_lock.clone(),
        );
        let written = tokio::task::spawn_blocking(move || {
            let _guard = lock(&write_lock);
            let snapshot = Versioned {
                schema_version: SCHEMA_VERSION,
                data: lock(&entries).clone(),
            };
            let bytes = serde_json::to_vec(&snapshot).map_err(|e| e.to_string())?;
            write_atomic(&path, &bytes)
        })
        .await;
        match written {
            Ok(Ok(())) => {}
            Ok(Err(e)) => log::warn!("[cache] {e}"),
            Err(e) => log::warn!("[cache] write task: {e}"),
        }
    }

    #[cfg(test)]
    fn seed(&self, key: &str, saved_at: u64, value: Value) {
        lock(&self.entries).insert(key.to_string(), Entry { saved_at, value });
    }
}

// Enables the disk cache under `<app_data_dir>/cache/`; without it, calls pass straight through.
pub fn init(app_data_dir: &Path) {
    let dir = app_data_dir.join("cache");
    if let Err(e) = std::fs::create_dir_all(&dir) {
        log::warn!("[cache] {}: {e}; memory cache only", dir.display());
        return;
    }
    let _ = DISK.set(DiskCache::open(dir.join("catalog.json"), MAX_ENTRIES));
}

pub async fn cached<T, F, Fut>(key: &str, ttl: Duration, fetch: F) -> Result<T, String>
where
    T: Serialize + DeserializeOwned,
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<T, String>>,
{
    match DISK.get() {
        Some(disk) => disk.get_or_fetch(key, ttl, fetch).await,
        None => fetch().await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::file::tests::scratch;
    use std::sync::atomic::{AtomicUsize, Ordering};

    const DAY: u64 = 24 * 60 * 60;

    fn cache(name: &str) -> (DiskCache, PathBuf) {
        let path = scratch(name).join("catalog.json");
        (DiskCache::open(path.clone(), MAX_ENTRIES), path)
    }

    async fn counted<T>(calls: &AtomicUsize, result: Result<T, String>) -> Result<T, String> {
        calls.fetch_add(1, Ordering::SeqCst);
        result
    }

    #[tokio::test]
    async fn a_fresh_entry_is_served_without_the_loader() {
        let (c, _) = cache("fresh");
        c.seed("k", now_secs() - 60, serde_json::json!([1, 2]));
        let calls = AtomicUsize::new(0);
        let v: Vec<u32> = c
            .get_or_fetch("k", PAGE_TTL, || counted(&calls, Ok(vec![9])))
            .await
            .unwrap();
        assert_eq!(v, vec![1, 2]);
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn an_expired_entry_falls_through_to_the_loader() {
        let (c, _) = cache("expired");
        c.seed("k", now_secs() - 2 * DAY, serde_json::json!([1]));
        let calls = AtomicUsize::new(0);
        let v: Vec<u32> = c
            .get_or_fetch("k", PAGE_TTL, || counted(&calls, Ok(vec![9])))
            .await
            .unwrap();
        assert_eq!(v, vec![9]);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn a_future_timestamp_is_not_fresh() {
        let (c, _) = cache("skew");
        c.seed("k", now_secs() + DAY, serde_json::json!([1]));
        let v: Vec<u32> = c
            .get_or_fetch("k", PAGE_TTL, || async { Ok(vec![9]) })
            .await
            .unwrap();
        assert_eq!(v, vec![9]);
    }

    #[tokio::test]
    async fn an_undecodable_entry_is_a_miss() {
        let (c, _) = cache("undecodable");
        c.seed("k", now_secs(), serde_json::json!({"not": "a list"}));
        let v: Vec<u32> = c
            .get_or_fetch("k", PAGE_TTL, || async { Ok(vec![9]) })
            .await
            .unwrap();
        assert_eq!(v, vec![9]);
    }

    #[tokio::test]
    async fn an_offline_error_serves_the_stale_entry() {
        let (c, _) = cache("stale");
        c.seed("k", now_secs() - 2 * DAY, serde_json::json!([1]));
        let v: Vec<u32> = c
            .get_or_fetch("k", PAGE_TTL, || async {
                Err(format!("{OFFLINE_PREFIX}connection refused"))
            })
            .await
            .unwrap();
        assert_eq!(v, vec![1]);
    }

    #[tokio::test]
    async fn an_offline_error_without_a_usable_entry_is_returned() {
        let (c, _) = cache("too-stale");
        c.seed("k", now_secs() - 31 * DAY, serde_json::json!([1]));
        let err = c
            .get_or_fetch::<Vec<u32>, _, _>("k", PAGE_TTL, || async {
                Err(format!("{OFFLINE_PREFIX}connection refused"))
            })
            .await
            .unwrap_err();
        assert!(err.starts_with(OFFLINE_PREFIX), "{err}");
    }

    #[tokio::test]
    async fn a_non_offline_error_is_returned_as_is() {
        let (c, _) = cache("http-error");
        c.seed("k", now_secs() - 2 * DAY, serde_json::json!([1]));
        let err = c
            .get_or_fetch::<Vec<u32>, _, _>("k", PAGE_TTL, || async {
                Err("HTTP status client error (401 Unauthorized)".to_string())
            })
            .await
            .unwrap_err();
        assert_eq!(err, "HTTP status client error (401 Unauthorized)");
    }

    #[tokio::test]
    async fn a_successful_fetch_survives_a_reopen() {
        let (c, path) = cache("reopen");
        let _: Vec<u32> = c
            .get_or_fetch("k", PAGE_TTL, || async { Ok(vec![7]) })
            .await
            .unwrap();
        let reopened = DiskCache::open(path, MAX_ENTRIES);
        let calls = AtomicUsize::new(0);
        let v: Vec<u32> = reopened
            .get_or_fetch("k", PAGE_TTL, || counted(&calls, Ok(vec![9])))
            .await
            .unwrap();
        assert_eq!(v, vec![7]);
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn a_corrupt_cache_file_starts_empty() {
        let path = scratch("corrupt").join("catalog.json");
        std::fs::write(&path, b"{ not json").unwrap();
        let c = DiskCache::open(path, MAX_ENTRIES);
        assert!(lock(&c.entries).is_empty());
        let v: Vec<u32> = c
            .get_or_fetch("k", PAGE_TTL, || async { Ok(vec![9]) })
            .await
            .unwrap();
        assert_eq!(v, vec![9]);
    }

    #[tokio::test]
    async fn entries_past_the_cap_evict_the_oldest() {
        let path = scratch("cap").join("catalog.json");
        let c = DiskCache::open(path, 2);
        c.seed("old", now_secs() - 3 * DAY, serde_json::json!(1));
        c.seed("mid", now_secs() - 2 * DAY, serde_json::json!(2));
        let _: u32 = c
            .get_or_fetch("new", PAGE_TTL, || async { Ok(3) })
            .await
            .unwrap();
        let entries = lock(&c.entries);
        assert!(!entries.contains_key("old"));
        assert!(entries.contains_key("mid") && entries.contains_key("new"));
    }

    #[tokio::test]
    async fn the_persisted_file_never_contains_an_api_key() {
        let (c, path) = cache("no-key");
        let _: Vec<String> = c
            .get_or_fetch("genres Movie", GENRES_TTL, || async {
                Ok(vec!["Action".to_string()])
            })
            .await
            .unwrap();
        let bytes = std::fs::read_to_string(&path).unwrap();
        assert!(!bytes.contains("api_key"));
        for key in ["TMDB_API_KEY", "RAWG_API_KEY"] {
            if let Ok(value) = std::env::var(key) {
                if !value.is_empty() {
                    assert!(!bytes.contains(&value), "{key} reached disk");
                }
            }
        }
    }

    #[tokio::test]
    async fn unset_path_is_a_pure_passthrough() {
        let calls = AtomicUsize::new(0);
        for _ in 0..2 {
            let v: Vec<u32> = cached("unset", PAGE_TTL, || counted(&calls, Ok(vec![1])))
                .await
                .unwrap();
            assert_eq!(v, vec![1]);
        }
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }
}
