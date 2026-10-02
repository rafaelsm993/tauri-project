pub mod ipc;

use crate::store::{current_version, Migration};
use serde::{Deserialize, Serialize};
use serde_json::Value;

// prefs.json upgrade steps, oldest first; a new field needs a serde default, not a step.
pub const MIGRATIONS: &[Migration] = &[rename_background_animation];
pub const SCHEMA_VERSION: u32 = current_version(MIGRATIONS);

// The colour scheme; `System` follows the OS light/dark setting.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Dark,
    Light,
}

// Everything the user sets once and the app remembers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Prefs {
    // Every decorative animation: background, level-up burst, planner movement.
    pub motion: bool,
    // The last level the user was congratulated on; 0 until the first check adopts the current one.
    pub seen_level: u32,
    // Asked the first time a book is planned; None until then.
    pub reading_pages_per_hour: Option<u32>,
    pub theme: Theme,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            motion: true,
            seen_level: 0,
            reading_pages_per_hour: None,
            theme: Theme::System,
        }
    }
}

// Fields a caller may change; absent = leave alone, `null` = clear.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PrefsPatch {
    pub motion: Option<bool>,
    pub seen_level: Option<u32>,
    #[serde(default, deserialize_with = "crate::store::present")]
    pub reading_pages_per_hour: Option<Option<u32>>,
    pub theme: Option<Theme>,
}

// v1 → v2: the background-only switch became the app-wide motion switch.
fn rename_background_animation(mut v: Value) -> Result<Value, String> {
    let map = v.as_object_mut().ok_or("prefs is not an object")?;
    if let Some(on) = map.remove("background_animation") {
        map.insert("motion".into(), on);
    }
    Ok(v)
}

pub fn validate_patch(patch: &PrefsPatch) -> Result<(), String> {
    match patch.reading_pages_per_hour {
        Some(Some(n)) if !(5..=300).contains(&n) => {
            Err(format!("{n} pages an hour is outside 5–300"))
        }
        _ => Ok(()),
    }
}

pub fn apply_patch(prefs: &mut Prefs, patch: PrefsPatch) {
    if let Some(on) = patch.motion {
        prefs.motion = on;
    }
    if let Some(level) = patch.seen_level {
        prefs.seen_level = level;
    }
    if let Some(pace) = patch.reading_pages_per_hour {
        prefs.reading_pages_per_hour = pace;
    }
    if let Some(theme) = patch.theme {
        prefs.theme = theme;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn motion_is_on_by_default() {
        assert!(Prefs::default().motion);
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
                motion: Some(false),
                ..PrefsPatch::default()
            },
        );
        assert!(!p.motion);
    }

    #[test]
    fn a_patch_with_an_unknown_field_is_rejected() {
        let err = serde_json::from_value::<PrefsPatch>(json!({ "motoin": false }));
        assert!(err.is_err());
    }

    #[test]
    fn a_file_from_before_level_ups_starts_with_no_level_seen() {
        let p: Prefs = serde_json::from_value(json!({ "motion": false })).unwrap();
        assert_eq!(p.seen_level, 0);
        assert!(!p.motion);
    }

    #[test]
    fn a_patch_records_the_last_celebrated_level_alone() {
        let mut p = Prefs::default();
        let patch: PrefsPatch = serde_json::from_value(json!({ "seen_level": 4 })).unwrap();
        apply_patch(&mut p, patch);
        assert_eq!(p.seen_level, 4);
        assert!(p.motion);
    }

    #[test]
    fn an_older_prefs_file_has_no_reading_pace() {
        let p: Prefs = serde_json::from_value(json!({ "seen_level": 2 })).unwrap();
        assert_eq!(p.reading_pages_per_hour, None);
    }

    #[test]
    fn a_patch_sets_and_clears_the_reading_pace() {
        let mut p = Prefs::default();
        let set: PrefsPatch =
            serde_json::from_value(json!({ "reading_pages_per_hour": 45 })).unwrap();
        apply_patch(&mut p, set);
        assert_eq!(p.reading_pages_per_hour, Some(45));
        apply_patch(&mut p, PrefsPatch::default());
        assert_eq!(p.reading_pages_per_hour, Some(45));
        let clear: PrefsPatch =
            serde_json::from_value(json!({ "reading_pages_per_hour": null })).unwrap();
        apply_patch(&mut p, clear);
        assert_eq!(p.reading_pages_per_hour, None);
    }

    #[test]
    fn a_reading_pace_outside_5_to_300_is_rejected() {
        let pace = |n| PrefsPatch {
            reading_pages_per_hour: Some(Some(n)),
            ..PrefsPatch::default()
        };
        assert!(validate_patch(&pace(4)).is_err());
        assert!(validate_patch(&pace(301)).is_err());
        assert!(validate_patch(&pace(5)).is_ok());
        assert!(validate_patch(&pace(300)).is_ok());
        assert!(validate_patch(&PrefsPatch::default()).is_ok());
    }

    #[test]
    fn a_v1_file_keeps_its_animation_choice_as_motion() {
        let v1 = json!({ "background_animation": false, "seen_level": 3 });
        let v2 = crate::store::migrate(v1, 0, MIGRATIONS).unwrap();
        assert_eq!(v2, json!({ "motion": false, "seen_level": 3 }));
        let p: Prefs = serde_json::from_value(v2).unwrap();
        assert!(!p.motion);
        assert_eq!(p.seen_level, 3);
    }

    #[test]
    fn a_v1_file_without_the_choice_gets_the_default() {
        let v2 = crate::store::migrate(json!({ "seen_level": 1 }), 0, MIGRATIONS).unwrap();
        assert_eq!(v2, json!({ "seen_level": 1 }));
        assert!(serde_json::from_value::<Prefs>(v2).unwrap().motion);
    }

    #[test]
    fn the_theme_follows_the_system_until_chosen() {
        assert_eq!(Prefs::default().theme, Theme::System);
        let old: Prefs = serde_json::from_value(json!({ "motion": false })).unwrap();
        assert_eq!(old.theme, Theme::System);
    }

    #[test]
    fn a_patch_picks_a_theme_by_name() {
        let mut p = Prefs::default();
        let patch: PrefsPatch = serde_json::from_value(json!({ "theme": "light" })).unwrap();
        apply_patch(&mut p, patch);
        assert_eq!(p.theme, Theme::Light);
        assert_eq!(serde_json::to_value(&p).unwrap()["theme"], json!("light"));
    }

    #[test]
    fn an_unknown_theme_is_refused() {
        let bad = serde_json::from_value::<PrefsPatch>(json!({ "theme": "sepia" }));
        assert!(bad.is_err());
    }

    #[test]
    fn the_old_patch_field_is_refused() {
        let old = serde_json::from_value::<PrefsPatch>(json!({ "background_animation": false }));
        assert!(old.is_err());
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
