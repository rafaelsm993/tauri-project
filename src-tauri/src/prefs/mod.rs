pub mod ipc;

use crate::store::{current_version, Migration};
use serde::{Deserialize, Serialize};

// prefs.json upgrade steps, oldest first; a new field needs a serde default, not a step.
pub const MIGRATIONS: &[Migration] = &[];
pub const SCHEMA_VERSION: u32 = current_version(MIGRATIONS);

// Everything the user sets once and the app remembers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Prefs {
    pub background_animation: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            background_animation: true,
        }
    }
}

// Fields a caller may change; absent = leave alone.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PrefsPatch {
    pub background_animation: Option<bool>,
}

pub fn apply_patch(prefs: &mut Prefs, patch: PrefsPatch) {
    if let Some(on) = patch.background_animation {
        prefs.background_animation = on;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    #[test]
    fn background_animation_is_on_by_default() {
        assert!(Prefs::default().background_animation);
    }

    #[test]
    fn an_empty_or_older_file_gets_defaults_for_missing_fields() {
        let p: Prefs = serde_json::from_value(json!({})).unwrap();
        assert_eq!(p, Prefs::default());
    }

    #[test]
    fn a_patch_changes_only_what_it_names() {
        let mut p = Prefs::default();
        apply_patch(&mut p, PrefsPatch::default());
        assert_eq!(p, Prefs::default());
        apply_patch(
            &mut p,
            PrefsPatch {
                background_animation: Some(false),
            },
        );
        assert!(!p.background_animation);
    }

    #[test]
    fn a_patch_with_an_unknown_field_is_rejected() {
        let err = serde_json::from_value::<PrefsPatch>(json!({ "background_animatoin": false }));
        assert!(err.is_err());
    }

    const CONTRACT: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../src/lib/types/prefs.contract.fixture.json"
    );

    #[test]
    fn prefs_contract_fixture_matches_the_rust_types() {
        let expected = json!({ "prefs": Prefs::default() });
        if std::env::var_os("UPDATE_CONTRACT").is_some() {
            let text = serde_json::to_string_pretty(&expected).unwrap() + "\n";
            std::fs::write(CONTRACT, text).unwrap();
        }
        let committed: Value = std::fs::read_to_string(CONTRACT)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .expect("missing prefs contract fixture; run with UPDATE_CONTRACT=1");
        assert_eq!(
            committed, expected,
            "Rust types changed; rerun with UPDATE_CONTRACT=1 and update prefs.ts"
        );
    }
}
