pub mod ipc;

use serde::{Deserialize, Serialize};

// Which provider a key belongs to; the two that refuse to answer without one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Keyed {
    Tmdb,
    Rawg,
}

// API keys the user pasted, kept in keys.json and never in a backup.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Keys {
    pub tmdb: Option<String>,
    pub rawg: Option<String>,
}

// What the frontend may know: whether a key is set, never the key itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Presence {
    pub tmdb: bool,
    pub rawg: bool,
}

impl Keys {
    pub fn get(&self, which: Keyed) -> Option<&str> {
        match which {
            Keyed::Tmdb => self.tmdb.as_deref(),
            Keyed::Rawg => self.rawg.as_deref(),
        }
    }

    pub fn set(&mut self, which: Keyed, key: Option<String>) {
        let slot = match which {
            Keyed::Tmdb => &mut self.tmdb,
            Keyed::Rawg => &mut self.rawg,
        };
        *slot = key.and_then(|k| clean(&k));
    }

    pub fn presence(&self) -> Presence {
        Presence {
            tmdb: self.tmdb.is_some(),
            rawg: self.rawg.is_some(),
        }
    }
}

// Blank or whitespace is not a key; a pasted key keeps no surrounding spaces.
pub fn clean(key: &str) -> Option<String> {
    let k = key.trim();
    (!k.is_empty()).then(|| k.to_string())
}

// Runtime env wins, then the key the user saved, then the one baked in at build time.
pub fn resolve(env: Option<&str>, stored: Option<&str>, compiled: Option<&str>) -> Option<String> {
    [env, stored, compiled]
        .into_iter()
        .flatten()
        .find_map(clean)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pasted_key_loses_its_surrounding_spaces() {
        assert_eq!(clean("  abc  "), Some("abc".into()));
    }

    #[test]
    fn blank_is_not_a_key() {
        assert_eq!(clean(""), None);
        assert_eq!(clean("   \n"), None);
    }

    #[test]
    fn env_wins_over_everything() {
        assert_eq!(
            resolve(Some("from-env"), Some("stored"), Some("compiled")),
            Some("from-env".into())
        );
    }

    #[test]
    fn the_saved_key_wins_over_the_compiled_one() {
        assert_eq!(
            resolve(None, Some("stored"), Some("compiled")),
            Some("stored".into())
        );
    }

    #[test]
    fn the_compiled_key_is_the_last_resort() {
        assert_eq!(
            resolve(None, None, Some("compiled")),
            Some("compiled".into())
        );
    }

    #[test]
    fn no_key_anywhere_resolves_to_nothing() {
        assert_eq!(resolve(None, None, None), None);
    }

    #[test]
    fn a_blank_source_is_skipped_for_the_next_one() {
        assert_eq!(
            resolve(Some("  "), Some("stored"), None),
            Some("stored".into())
        );
        assert_eq!(
            resolve(None, Some(""), Some("compiled")),
            Some("compiled".into())
        );
    }

    #[test]
    fn presence_tells_which_keys_are_set_without_leaking_them() {
        let mut keys = Keys::default();
        assert_eq!(
            keys.presence(),
            Presence {
                tmdb: false,
                rawg: false
            }
        );
        keys.set(Keyed::Tmdb, Some("secret".into()));
        assert_eq!(
            keys.presence(),
            Presence {
                tmdb: true,
                rawg: false
            }
        );
        let shown = serde_json::to_string(&keys.presence()).unwrap();
        assert!(
            !shown.contains("secret"),
            "presence leaked the key: {shown}"
        );
    }

    #[test]
    fn setting_a_blank_key_clears_the_slot() {
        let mut keys = Keys::default();
        keys.set(Keyed::Rawg, Some("abc".into()));
        assert_eq!(keys.get(Keyed::Rawg), Some("abc"));
        keys.set(Keyed::Rawg, Some("   ".into()));
        assert_eq!(keys.get(Keyed::Rawg), None);
    }

    #[test]
    fn clearing_one_key_leaves_the_other() {
        let mut keys = Keys::default();
        keys.set(Keyed::Tmdb, Some("t".into()));
        keys.set(Keyed::Rawg, Some("r".into()));
        keys.set(Keyed::Tmdb, None);
        assert_eq!(keys.get(Keyed::Tmdb), None);
        assert_eq!(keys.get(Keyed::Rawg), Some("r"));
    }

    #[test]
    fn keys_json_round_trips() {
        let mut keys = Keys::default();
        keys.set(Keyed::Tmdb, Some("t".into()));
        let text = serde_json::to_string(&keys).unwrap();
        assert_eq!(serde_json::from_str::<Keys>(&text).unwrap(), keys);
    }

    #[test]
    fn a_keys_file_from_an_older_app_without_rawg_still_loads() {
        let keys: Keys = serde_json::from_str(r#"{"tmdb":"t"}"#).unwrap();
        assert_eq!(keys.get(Keyed::Tmdb), Some("t"));
        assert_eq!(keys.get(Keyed::Rawg), None);
    }
}
