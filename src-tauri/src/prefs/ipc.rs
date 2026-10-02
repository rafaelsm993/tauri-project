use super::{apply_patch, validate_patch, Prefs, PrefsPatch, MIGRATIONS, SCHEMA_VERSION};
use crate::store::{self, writer::StoreHandle};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tauri::State;

const AUTOSAVE: Duration = Duration::from_millis(500);

// Single owner of prefs.json.
pub struct PrefsState {
    pub store: Arc<StoreHandle<Prefs>>,
}

/// Loads `prefs.json` from `dir` (defaults when missing) and starts the autosave loop.
pub fn init(dir: &Path) -> Result<PrefsState, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    let path = dir.join("prefs.json");
    let loaded = store::load::<Prefs>(&path, MIGRATIONS)?;
    let migrated = loaded.as_ref().is_some_and(|l| l.migrated);
    let prefs = loaded.map(|l| l.data).unwrap_or_default();
    let state = PrefsState {
        store: StoreHandle::new(path, SCHEMA_VERSION, prefs),
    };
    if migrated {
        state.store.mark_dirty();
    }
    state.store.clone().spawn_autosave(AUTOSAVE);
    Ok(state)
}

pub async fn load(state: &PrefsState) -> Prefs {
    state.store.read(Prefs::clone).await
}

pub async fn update(state: &PrefsState, patch: PrefsPatch) -> Result<Prefs, String> {
    validate_patch(&patch)?;
    state
        .store
        .commit(|p| {
            apply_patch(p, patch);
            Ok(p.clone())
        })
        .await
}

#[tauri::command]
pub async fn prefs_load(state: State<'_, PrefsState>) -> Result<Prefs, String> {
    Ok(load(&state).await)
}

#[tauri::command]
pub async fn prefs_update(
    state: State<'_, PrefsState>,
    patch: PrefsPatch,
) -> Result<Prefs, String> {
    update(&state, patch).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::file::tests::scratch;

    #[test]
    fn init_works_outside_a_tokio_runtime_like_tauri_setup() {
        let dir = scratch("prefs-no-runtime");
        assert!(init(&dir).is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_fresh_install_has_defaults_and_writes_nothing() {
        let dir = scratch("prefs-fresh").join("nested");
        let state = init(&dir).unwrap();
        assert_eq!(load(&state).await, Prefs::default());
        assert!(!dir.join("prefs.json").exists());
        std::fs::remove_dir_all(dir.parent().unwrap()).unwrap();
    }

    #[tokio::test]
    async fn an_update_is_saved_and_survives_a_restart() {
        let dir = scratch("prefs-restart");
        let first = init(&dir).unwrap();
        let saved = update(
            &first,
            PrefsPatch {
                motion: Some(false),
                ..PrefsPatch::default()
            },
        )
        .await
        .unwrap();
        assert!(!saved.motion);
        drop(first);
        let second = init(&dir).unwrap();
        assert!(!load(&second).await.motion);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_failed_save_keeps_prefs_unchanged_in_memory_and_on_disk() {
        let dir = scratch("prefs-failed-save");
        let state = init(&dir).unwrap();
        std::fs::create_dir_all(dir.join("prefs.json")).unwrap();
        let saved = update(
            &state,
            PrefsPatch {
                motion: Some(false),
                ..PrefsPatch::default()
            },
        )
        .await;
        assert!(saved.is_err());
        assert!(load(&state).await.motion);
        assert!(dir.join("prefs.json").is_dir());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn an_invalid_reading_pace_changes_nothing() {
        let dir = scratch("prefs-bad-pace");
        let state = init(&dir).unwrap();
        let saved = update(
            &state,
            PrefsPatch {
                reading_pages_per_hour: Some(Some(0)),
                ..PrefsPatch::default()
            },
        )
        .await;
        assert!(saved.is_err());
        assert_eq!(load(&state).await, Prefs::default());
        assert!(!dir.join("prefs.json").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_v1_file_on_disk_loads_as_motion_and_is_rewritten_at_v2() {
        let dir = scratch("prefs-v1");
        let path = dir.join("prefs.json");
        std::fs::write(
            &path,
            br#"{"schema_version":1,"data":{"background_animation":false,"seen_level":2}}"#,
        )
        .unwrap();
        let state = init(&dir).unwrap();
        assert!(!load(&state).await.motion);
        state.store.flush().await.unwrap();
        let saved: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(saved["schema_version"], 2);
        assert_eq!(saved["data"]["motion"], false);
        assert!(saved["data"].get("background_animation").is_none());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn init_refuses_prefs_from_a_newer_app() {
        let dir = scratch("prefs-newer");
        std::fs::write(
            dir.join("prefs.json"),
            br#"{"schema_version":99,"data":{}}"#,
        )
        .unwrap();
        let err = init(&dir).err().expect("a newer file must not load");
        assert!(err.contains("newer version of the app"), "{err}");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
