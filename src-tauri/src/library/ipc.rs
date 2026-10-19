use super::commands::{self, LibraryFile, LibraryState, MergePreview, UserPatch, MIGRATIONS};
use super::manual::ManualDraft;
use super::posters;
use super::types::{Event, Length, LibraryEntry, UserData};
use crate::api::types::MediaItem;
use crate::store;
use std::collections::BTreeMap;
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
    event: Event,
) -> Result<LibraryEntry, String> {
    let entry = commands::add(&state, &item, user.unwrap_or_default(), event).await?;
    tauri::async_runtime::spawn(posters::fill(state.inner().clone()));
    Ok(entry)
}

// The key's id is made here, so two items with the same title never collide.
#[tauri::command]
pub async fn library_add_manual(
    state: State<'_, LibraryState>,
    draft: ManualDraft,
    user: Option<UserData>,
    event: Event,
) -> Result<LibraryEntry, String> {
    let id = uuid::Uuid::new_v4().to_string();
    commands::add_manual(&state, &id, &draft, user.unwrap_or_default(), event).await
}

#[tauri::command]
pub async fn library_edit_manual(
    state: State<'_, LibraryState>,
    key: String,
    draft: ManualDraft,
    event: Event,
) -> Result<LibraryEntry, String> {
    commands::edit_manual(&state, &key, &draft, event).await
}

#[tauri::command]
pub async fn library_update(
    state: State<'_, LibraryState>,
    key: String,
    patch: UserPatch,
    event: Event,
) -> Result<LibraryEntry, String> {
    commands::update(&state, &key, patch, event).await
}

#[tauri::command]
pub async fn library_remove(
    state: State<'_, LibraryState>,
    key: String,
    event: Event,
) -> Result<bool, String> {
    commands::remove(&state, &key, event).await
}

// Read-only; the frontend derives XP, levels and streaks from it.
#[tauri::command]
pub async fn library_events(state: State<'_, LibraryState>) -> Result<Vec<Event>, String> {
    commands::events(&state)
}

// A dry run of `library_merge`, so the UI shows exactly what would be saved.
#[tauri::command]
pub async fn library_merge_preview(
    state: State<'_, LibraryState>,
    key: String,
    item: MediaItem,
    catalog_length: Length,
) -> Result<MergePreview, String> {
    commands::merge_preview(&state, &key, &item, &catalog_length).await
}

#[tauri::command]
pub async fn library_merge(
    state: State<'_, LibraryState>,
    key: String,
    item: MediaItem,
    catalog_length: Length,
    event: Event,
) -> Result<LibraryEntry, String> {
    let entry = commands::merge(&state, &key, &item, &catalog_length, event).await?;
    tauri::async_runtime::spawn(posters::fill(state.inner().clone()));
    Ok(entry)
}

#[tauri::command]
pub async fn library_unmerge(
    state: State<'_, LibraryState>,
    key: String,
    event: Event,
) -> Result<LibraryEntry, String> {
    commands::unmerge(&state, &key, event).await
}

// Manual key → catalog key; read beside the events so XP follows a merged item.
#[tauri::command]
pub async fn library_aliases(
    state: State<'_, LibraryState>,
) -> Result<BTreeMap<String, String>, String> {
    Ok(commands::aliases(&state).await)
}

// Called on reconnect: every missing poster is tried again right away.
#[tauri::command]
pub async fn library_retry_posters(state: State<'_, LibraryState>) -> Result<(), String> {
    posters::forget_failures(&state).await;
    tauri::async_runtime::spawn(posters::fill(state.inner().clone()));
    Ok(())
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
    use crate::library::types::tests::stamped;
    use crate::library::types::EventKind;
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
        commands::add(
            &first,
            &item,
            UserData::default(),
            stamped(EventKind::LibraryAdd, "tmdb:tv:7", "a", "t1"),
        )
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

    #[tokio::test]
    async fn a_v1_library_loads_with_no_merges_and_is_saved_again_as_v2() {
        let dir = scratch("ipc-v1");
        let path = dir.join("library.json");
        std::fs::write(
            &path,
            br#"{"schema_version":1,"data":{"entries":{"tmdb:tv:7":{"key":"tmdb:tv:7","snapshot":{"media_key":"tmdb:tv:7","provider":"tmdb","media_type":"tv","title":"Arcane"}}}}}"#,
        )
        .unwrap();
        let state = init(&dir).unwrap();
        assert_eq!(commands::load(&state).await.len(), 1);
        assert!(state.store.read(|f| f.merged.is_empty()).await);
        assert!(
            state.store.flush().await.unwrap(),
            "a migrated file is written again"
        );
        let saved: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(saved["schema_version"], 2);
        assert_eq!(saved["data"]["merged"], serde_json::json!({}));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
