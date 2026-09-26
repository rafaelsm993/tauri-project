pub mod file;
pub mod writer;

use file::{sibling, Versioned};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::io::ErrorKind;
use std::path::Path;

// A migration upgrades raw JSON by exactly one schema version.
pub type Migration = fn(Value) -> Result<Value, String>;

// Upgrades raw JSON from `from` to `steps.len()` one step at a time.
pub fn migrate(value: Value, from: u32, steps: &[Migration]) -> Result<Value, String> {
    let from = from as usize;
    if from > steps.len() {
        return Err(format!(
            "file schema v{from} is newer than this app (v{}); update the app",
            steps.len()
        ));
    }
    steps[from..].iter().try_fold(value, |v, step| step(v))
}

// Schema version a file has after all `steps`; files start at v1.
pub const fn current_version(steps: &[Migration]) -> u32 {
    steps.len() as u32 + 1
}

// A file read back from disk; `migrated` means it should be written again at the new version.
#[derive(Debug, PartialEq)]
pub struct Loaded<T> {
    pub data: T,
    pub migrated: bool,
}

// Why a versioned value could not become `T`.
#[derive(Debug, PartialEq)]
pub enum UpgradeError {
    Newer { found: u32, current: u32 },
    Migrate(String),
    Unfit(String),
}

// Upgrades one versioned value with `steps`; refuses data from a newer app.
pub fn upgrade<T: DeserializeOwned>(
    raw: Versioned<Value>,
    steps: &[Migration],
) -> Result<Loaded<T>, UpgradeError> {
    let current = current_version(steps);
    if raw.schema_version > current {
        return Err(UpgradeError::Newer {
            found: raw.schema_version,
            current,
        });
    }
    let from = raw.schema_version.max(1) - 1;
    let value = migrate(raw.data, from, steps).map_err(UpgradeError::Migrate)?;
    let data = serde_json::from_value(value).map_err(|e| UpgradeError::Unfit(e.to_string()))?;
    Ok(Loaded {
        data,
        migrated: raw.schema_version < current,
    })
}

// Reads `path` (else `.bak`), upgrades it with `steps`, and refuses files from a newer app.
pub fn load<T: DeserializeOwned>(
    path: &Path,
    steps: &[Migration],
) -> Result<Option<Loaded<T>>, String> {
    let mut found_file = false;
    for candidate in [path.to_path_buf(), sibling(path, ".bak")] {
        let bytes = match std::fs::read(&candidate) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == ErrorKind::NotFound => continue,
            Err(e) => return Err(format!("read {}: {e}", candidate.display())),
        };
        found_file = true;
        let raw: Versioned<Value> = match serde_json::from_slice(&bytes) {
            Ok(raw) => raw,
            Err(e) => {
                log::warn!("[store] {} unreadable: {e}", candidate.display());
                continue;
            }
        };
        match upgrade(raw, steps) {
            Ok(loaded) => return Ok(Some(loaded)),
            Err(UpgradeError::Newer { found, current }) => {
                return Err(format!(
                    "{} was written by a newer version of the app (schema v{found}, this app reads up to v{current}); update the app",
                    candidate.display()
                ))
            }
            Err(UpgradeError::Migrate(e)) => {
                return Err(format!("upgrade {}: {e}", candidate.display()))
            }
            Err(UpgradeError::Unfit(e)) => {
                log::warn!("[store] {} does not fit the schema: {e}", candidate.display())
            }
        }
    }
    // A present file must never be silently replaced by an empty default.
    if found_file {
        return Err(format!(
            "{} exists but cannot be read by this version of the app; the file was left untouched",
            path.display()
        ));
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::file::tests::scratch;
    use crate::store::file::write_atomic;
    use serde::Deserialize;
    use serde_json::json;
    use std::fs;

    fn add_status(mut v: Value) -> Result<Value, String> {
        v["status"] = json!("planning");
        Ok(v)
    }

    fn rename_title(mut v: Value) -> Result<Value, String> {
        let title = v["name"].take();
        v["title"] = title;
        v.as_object_mut().unwrap().remove("name");
        Ok(v)
    }

    #[test]
    fn current_version_is_a_no_op() {
        let steps: [Migration; 2] = [add_status, rename_title];
        let v = json!({ "title": "Dune", "status": "completed" });
        assert_eq!(migrate(v.clone(), 2, &steps).unwrap(), v);
    }

    #[test]
    fn applies_every_missing_step_in_order() {
        let steps: [Migration; 2] = [add_status, rename_title];
        let out = migrate(json!({ "name": "Dune" }), 0, &steps).unwrap();
        assert_eq!(out, json!({ "title": "Dune", "status": "planning" }));
    }

    #[test]
    fn starts_from_the_stored_version() {
        let steps: [Migration; 2] = [add_status, rename_title];
        let out = migrate(json!({ "name": "Dune", "status": "dropped" }), 1, &steps).unwrap();
        assert_eq!(out, json!({ "title": "Dune", "status": "dropped" }));
    }

    #[test]
    fn rejects_a_newer_version_than_the_app_knows() {
        let steps: [Migration; 1] = [add_status];
        let err = migrate(json!({}), 3, &steps).unwrap_err();
        assert!(err.contains("newer"), "{err}");
    }

    fn put(path: &std::path::Path, version: u32, data: Value) {
        let bytes =
            serde_json::to_vec(&json!({ "schema_version": version, "data": data })).unwrap();
        write_atomic(path, &bytes).unwrap();
    }

    #[derive(Debug, Deserialize, PartialEq)]
    struct Book {
        title: String,
        #[serde(default)]
        status: Option<String>,
    }

    const STEPS: [Migration; 1] = [add_status];

    #[test]
    fn current_version_matches_the_number_of_steps() {
        assert_eq!(current_version(&[]), 1);
        assert_eq!(current_version(&STEPS), 2);
    }

    #[test]
    fn load_of_a_missing_file_is_none() {
        let dir = scratch("load-missing");
        let got: Option<Loaded<Book>> = load(&dir.join("x.json"), &STEPS).unwrap();
        assert_eq!(got, None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn load_at_the_current_version_is_not_marked_migrated() {
        let dir = scratch("load-current");
        let path = dir.join("x.json");
        put(&path, 2, json!({ "title": "Dune", "status": "dropped" }));
        let got: Loaded<Book> = load(&path, &STEPS).unwrap().unwrap();
        assert_eq!(got.data.status.as_deref(), Some("dropped"));
        assert!(!got.migrated);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn load_upgrades_an_older_file_and_says_so() {
        let dir = scratch("load-old");
        let path = dir.join("x.json");
        put(&path, 1, json!({ "title": "Dune" }));
        let got: Loaded<Book> = load(&path, &STEPS).unwrap().unwrap();
        assert_eq!(got.data.status.as_deref(), Some("planning"));
        assert!(got.migrated);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn load_refuses_a_file_from_a_newer_app_and_leaves_it_alone() {
        let dir = scratch("load-newer");
        let path = dir.join("x.json");
        put(&path, 9, json!({ "title": "Dune" }));
        let before = fs::read(&path).unwrap();
        let err = load::<Book>(&path, &STEPS).unwrap_err();
        assert!(err.contains("newer version of the app"), "{err}");
        assert_eq!(fs::read(&path).unwrap(), before);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn load_refuses_when_files_exist_but_none_is_usable() {
        let dir = scratch("load-all-unusable");
        let path = dir.join("x.json");
        fs::write(&path, b"{ truncated").unwrap();
        fs::write(sibling(&path, ".bak"), b"also junk").unwrap();
        let before = fs::read(&path).unwrap();
        let err = load::<Book>(&path, &STEPS).unwrap_err();
        assert!(err.contains("left untouched"), "{err}");
        assert_eq!(fs::read(&path).unwrap(), before);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn load_refuses_a_lone_file_that_does_not_fit_the_schema() {
        let dir = scratch("load-unfit");
        let path = dir.join("x.json");
        put(&path, 2, json!({ "no_title": true }));
        std::fs::remove_file(sibling(&path, ".bak")).ok();
        let err = load::<Book>(&path, &STEPS).unwrap_err();
        assert!(err.contains("left untouched"), "{err}");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn load_falls_back_to_bak_when_the_main_file_is_unusable() {
        let dir = scratch("load-bak");
        let path = dir.join("x.json");
        put(&path, 2, json!({ "title": "Old" }));
        put(&path, 2, json!({ "no_title": true }));
        let got: Loaded<Book> = load(&path, &STEPS).unwrap().unwrap();
        assert_eq!(got.data.title, "Old");
        fs::remove_dir_all(&dir).unwrap();
    }

    fn raw(version: u32, data: Value) -> Versioned<Value> {
        Versioned {
            schema_version: version,
            data,
        }
    }

    #[test]
    fn upgrade_migrates_an_older_value_and_says_so() {
        let got: Loaded<Book> = upgrade(raw(1, json!({ "title": "Dune" })), &STEPS).unwrap();
        assert_eq!(got.data.status.as_deref(), Some("planning"));
        assert!(got.migrated);
    }

    #[test]
    fn upgrade_refuses_a_newer_value() {
        let err = upgrade::<Book>(raw(9, json!({ "title": "Dune" })), &STEPS).unwrap_err();
        assert_eq!(
            err,
            UpgradeError::Newer {
                found: 9,
                current: 2
            }
        );
    }

    #[test]
    fn upgrade_reports_a_value_that_does_not_fit() {
        let err = upgrade::<Book>(raw(2, json!({ "no_title": true })), &STEPS).unwrap_err();
        assert!(matches!(err, UpgradeError::Unfit(_)), "{err:?}");
    }
}
