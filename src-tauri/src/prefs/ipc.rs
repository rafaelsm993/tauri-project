use super::{apply_patch, Prefs, PrefsPatch, MIGRATIONS, SCHEMA_VERSION};
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
                background_animation: Some(false),
            },
        )
        .await
        .unwrap();
        assert!(!saved.background_animation);
        drop(first);
        let second = init(&dir).unwrap();
        assert!(!load(&second).await.background_animation);
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
                background_animation: Some(false),
            },
        )
        .await;
        assert!(saved.is_err());
        assert!(load(&state).await.background_animation);
        assert!(dir.join("prefs.json").is_dir());
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
