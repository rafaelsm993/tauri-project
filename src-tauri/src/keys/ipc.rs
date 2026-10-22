use super::{clean, resolve, Keyed, Keys, Presence};
use crate::store::{self, writer::StoreHandle};
use std::path::Path;
use std::sync::{Arc, OnceLock, RwLock};
use tauri::State;

// keys.json has no migrations yet; it starts at v1.
const SCHEMA_VERSION: u32 = 1;

// Sync mirror of the saved keys, so a provider can read one without awaiting.
fn cache() -> &'static RwLock<Keys> {
    static CACHE: OnceLock<RwLock<Keys>> = OnceLock::new();
    CACHE.get_or_init(|| RwLock::new(Keys::default()))
}

// The key a provider should use: runtime env, then the saved key, then the compiled one.
pub fn key_for(which: Keyed, compiled: Option<&str>) -> Option<String> {
    let env = std::env::var(env_var(which)).ok();
    let stored = cache()
        .read()
        .ok()
        .and_then(|k| k.get(which).map(String::from));
    resolve(env.as_deref(), stored.as_deref(), compiled)
}

pub fn env_var(which: Keyed) -> &'static str {
    match which {
        Keyed::Tmdb => "TMDB_API_KEY",
        Keyed::Rawg => "RAWG_API_KEY",
    }
}

fn remember(keys: &Keys) {
    if let Ok(mut c) = cache().write() {
        *c = keys.clone();
    }
}

// Single owner of keys.json.
pub struct KeysState {
    pub store: Arc<StoreHandle<Keys>>,
}

/// Loads `keys.json` from `dir` (empty when missing) and fills the sync cache.
pub fn init(dir: &Path) -> Result<KeysState, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    let path = dir.join("keys.json");
    let keys = store::load::<Keys>(&path, &[])?
        .map(|l| l.data)
        .unwrap_or_default();
    remember(&keys);
    Ok(KeysState {
        store: StoreHandle::new(path, SCHEMA_VERSION, keys),
    })
}

pub async fn set(state: &KeysState, which: Keyed, key: Option<String>) -> Result<Presence, String> {
    let out = state
        .store
        .commit(|keys| {
            keys.set(which, key);
            Ok(keys.presence())
        })
        .await;
    // Mirror whatever the store ended up with: a failed write rolled it back.
    remember(&state.store.read(Keys::clone).await);
    out
}

// One live request that only asks "does this key work?".
pub async fn check(which: Keyed, key: &str) -> Result<(), String> {
    let Some(key) = clean(key) else {
        return Err("Paste a key first.".into());
    };
    let url = match which {
        Keyed::Tmdb => format!("https://api.themoviedb.org/3/configuration?api_key={key}"),
        Keyed::Rawg => format!("https://api.rawg.io/api/genres?key={key}"),
    };
    let res = crate::api::http::client()
        .get(url)
        .send()
        .await
        .map_err(|_| "Could not reach the provider. Check your connection.".to_string())?;
    match res.status().as_u16() {
        200 => Ok(()),
        401 | 403 => Err("That key was refused. Check it and try again.".into()),
        429 => Err("The provider is rate limiting right now. Try again shortly.".into()),
        other => Err(format!("The provider answered with {other}.")),
    }
}

#[tauri::command]
pub async fn keys_check(which: Keyed, key: String) -> Result<(), String> {
    check(which, &key).await
}

#[tauri::command]
pub async fn keys_status(state: State<'_, KeysState>) -> Result<Presence, String> {
    Ok(state.store.read(Keys::presence).await)
}

#[tauri::command]
pub async fn keys_set(
    state: State<'_, KeysState>,
    which: Keyed,
    key: String,
) -> Result<Presence, String> {
    set(&state, which, clean(&key)).await
}

#[tauri::command]
pub async fn keys_clear(state: State<'_, KeysState>, which: Keyed) -> Result<Presence, String> {
    set(&state, which, None).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::file::tests::scratch;

    #[tokio::test]
    async fn a_saved_key_survives_a_restart() {
        let dir = scratch("keys-restart");
        let state = init(&dir).unwrap();
        set(&state, Keyed::Tmdb, Some("abc".into())).await.unwrap();

        let again = init(&dir).unwrap();
        assert_eq!(
            again
                .store
                .read(|k| k.get(Keyed::Tmdb).map(String::from))
                .await,
            Some("abc".into())
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn clearing_a_key_removes_it_from_disk() {
        let dir = scratch("keys-clear");
        let state = init(&dir).unwrap();
        set(&state, Keyed::Rawg, Some("abc".into())).await.unwrap();
        set(&state, Keyed::Rawg, None).await.unwrap();

        let again = init(&dir).unwrap();
        assert_eq!(
            again.store.read(|k| k.presence()).await,
            Presence {
                tmdb: false,
                rawg: false
            }
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_missing_keys_file_is_not_an_error() {
        let dir = scratch("keys-missing");
        let state = init(&dir).unwrap();
        assert_eq!(
            state.store.read(Keys::presence).await,
            Presence {
                tmdb: false,
                rawg: false
            }
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_saved_key_is_what_a_provider_reads() {
        let dir = scratch("keys-provider");
        let state = init(&dir).unwrap();
        std::env::remove_var(env_var(Keyed::Rawg));
        set(&state, Keyed::Rawg, Some("saved".into()))
            .await
            .unwrap();
        assert_eq!(key_for(Keyed::Rawg, Some("compiled")), Some("saved".into()));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
