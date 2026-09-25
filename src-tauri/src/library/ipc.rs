use super::commands::{self, LibraryFile, LibraryState, UserPatch, MIGRATIONS};
use super::posters;
use super::types::{Event, LibraryEntry, UserData};
use crate::api::types::MediaItem;
use crate::store;
use std::path::Path;
use std::time::Duration;
use tauri::State;

const AUTOSAVE: Duration = Duration::from_millis(500);

/// Loads `library.json` from `dir` (recovering from `.bak`), and starts the autosave loop.
pub fn init(dir: &Path) -> Result<LibraryState, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    let path = dir.join("library.json");
    let loaded = store::load::<LibraryFile>(&path, MIGRATIONS)?;
    let migrated = loaded.as_ref().is_some_and(|l| l.migrated);
    let file = loaded.map(|l| l.data).unwrap_or_default();
    log::info!(
        "[library] {} entries from {}",
        file.entries.len(),
        dir.display()
    );
    let state = LibraryState::new(dir, file);
    if migrated {
        state.store.mark_dirty();
    }
    state.store.clone().spawn_autosave(AUTOSAVE);
    tauri::async_runtime::spawn(posters::fill(state.clone()));
    Ok(state)
}

#[tauri::command]
pub async fn library_load(state: State<'_, LibraryState>) -> Result<Vec<LibraryEntry>, String> {
    Ok(commands::load(&state).await)
}

#[tauri::command]
pub async fn library_add(
    state: State<'_, LibraryState>,
    item: MediaItem,
    user: Option<UserData>,
    at: String,
    event: Option<Event>,
) -> Result<LibraryEntry, String> {
    let entry = commands::add(&state, &item, user.unwrap_or_default(), at, event).await?;
    tauri::async_runtime::spawn(posters::fill(state.inner().clone()));
    Ok(entry)
}

#[tauri::command]
pub async fn library_update(
    state: State<'_, LibraryState>,
    key: String,
    patch: UserPatch,
    at: String,
    event: Option<Event>,
) -> Result<LibraryEntry, String> {
    commands::update(&state, &key, patch, at, event).await
}

#[tauri::command]
pub async fn library_remove(
    state: State<'_, LibraryState>,
    key: String,
    event: Option<Event>,
) -> Result<bool, String> {
    commands::remove(&state, &key, event).await
}

// Absolute poster cache folder; the UI joins file names to it for convertFileSrc.
#[tauri::command]
pub fn library_poster_dir(state: State<'_, LibraryState>) -> String {
    state.posters.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::types::{Id, MediaType, ProviderId};
    use crate::store::file::tests::scratch;

    #[test]
    fn init_works_outside_a_tokio_runtime_like_tauri_setup() {
        let dir = scratch("ipc-no-runtime");
        assert!(init(&dir).is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn init_creates_a_missing_dir_and_starts_empty() {
        let dir = scratch("ipc-fresh").join("nested");
        let state = init(&dir).unwrap();
        assert!(dir.exists());
        assert!(commands::load(&state).await.is_empty());
        std::fs::remove_dir_all(dir.parent().unwrap()).unwrap();
    }

    #[tokio::test]
    async fn init_reloads_what_a_previous_run_saved() {
        let dir = scratch("ipc-reload");
        let first = init(&dir).unwrap();
        let item = MediaItem::new(Id::Num(7), "Arcane".into(), MediaType::Tv, ProviderId::Tmdb);
        commands::add(&first, &item, UserData::default(), "t1".into(), None)
            .await
            .unwrap();
        drop(first);

        let second = init(&dir).unwrap();
        let entries = commands::load(&second).await;
        assert_eq!(entries.len(), 1, "a restart must see the saved library");
        assert_eq!(entries[0].key, "tmdb:tv:7");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn init_refuses_a_library_from_a_newer_app_and_keeps_the_file() {
        let dir = scratch("ipc-newer");
        let path = dir.join("library.json");
        std::fs::write(&path, br#"{"schema_version":99,"data":{"entries":{}}}"#).unwrap();
        let before = std::fs::read(&path).unwrap();
        let err = init(&dir).err().expect("a newer file must not load");
        assert!(err.contains("newer version of the app"), "{err}");
        assert_eq!(std::fs::read(&path).unwrap(), before);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
