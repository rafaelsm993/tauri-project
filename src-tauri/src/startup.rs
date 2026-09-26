use crate::library::commands::LibraryState;
use crate::prefs::ipc::PrefsState;
use serde::Serialize;
use std::path::Path;
use tauri::State;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProblemKind {
    Newer,
    Unreadable,
}

// Why the saved data did not load; the app shows this instead of starting.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StartupProblem {
    pub kind: ProblemKind,
    pub file: String,
    pub dir: String,
    pub detail: String,
}

#[derive(Default)]
pub struct StartupState(pub Option<StartupProblem>);

pub fn classify(err: &str) -> ProblemKind {
    if err.contains("newer version of the app") || err.contains("newer than this app") {
        ProblemKind::Newer
    } else {
        ProblemKind::Unreadable
    }
}

fn problem(file: &str, dir: &Path, err: String) -> StartupProblem {
    StartupProblem {
        kind: classify(&err),
        file: file.into(),
        dir: dir.display().to_string(),
        detail: err,
    }
}

// Loads the saved library and prefs; a refused file becomes a problem, never an overwrite.
pub fn load(dir: &Path) -> Result<(LibraryState, PrefsState), StartupProblem> {
    let library = crate::library::ipc::init(dir).map_err(|e| problem("library.json", dir, e))?;
    let prefs = crate::prefs::ipc::init(dir).map_err(|e| problem("prefs.json", dir, e))?;
    Ok((library, prefs))
}

#[tauri::command]
pub fn startup_status(state: State<'_, StartupState>) -> Option<StartupProblem> {
    state.0.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::file::tests::scratch;
    use serde_json::{json, Value};

    const NEWER: &[u8] = br#"{"schema_version":99,"data":{"entries":{}}}"#;

    #[test]
    fn classify_tells_a_newer_file_from_an_unreadable_one() {
        let newer = "x was written by a newer version of the app (schema v9); update the app";
        assert_eq!(classify(newer), ProblemKind::Newer);
        assert_eq!(
            classify("file schema v9 is newer than this app (v1)"),
            ProblemKind::Newer
        );
        let broken = "x exists but cannot be read by this version of the app";
        assert_eq!(classify(broken), ProblemKind::Unreadable);
        assert_eq!(
            classify("read x: Access is denied."),
            ProblemKind::Unreadable
        );
    }

    #[test]
    fn a_newer_library_is_a_problem_and_stays_on_disk() {
        let dir = scratch("startup-newer");
        std::fs::write(dir.join("library.json"), NEWER).unwrap();
        let p = load(&dir).err().expect("a newer library must not load");
        assert_eq!(p.kind, ProblemKind::Newer);
        assert_eq!(p.file, "library.json");
        assert_eq!(p.dir, dir.display().to_string());
        assert_eq!(std::fs::read(dir.join("library.json")).unwrap(), NEWER);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn unreadable_prefs_are_a_problem_too() {
        let dir = scratch("startup-prefs");
        std::fs::write(dir.join("prefs.json"), b"not json").unwrap();
        let p = load(&dir).err().expect("a broken prefs file must not load");
        assert_eq!(
            (p.kind, p.file.as_str()),
            (ProblemKind::Unreadable, "prefs.json")
        );
        assert_eq!(std::fs::read(dir.join("prefs.json")).unwrap(), b"not json");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn an_empty_folder_starts_fine() {
        let dir = scratch("startup-empty");
        assert!(load(&dir).is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    const CONTRACT: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../src/lib/types/startup.contract.fixture.json"
    );

    #[test]
    fn startup_contract_fixture_matches_the_rust_types() {
        let expected = json!({
            "problem": StartupProblem {
                kind: ProblemKind::Newer,
                file: "library.json".into(),
                dir: "/data/aevum".into(),
                detail: "update the app".into(),
            },
            "kinds": [ProblemKind::Newer, ProblemKind::Unreadable],
        });
        if std::env::var_os("UPDATE_CONTRACT").is_some() {
            let text = serde_json::to_string_pretty(&expected).unwrap() + "\n";
            std::fs::write(CONTRACT, text).unwrap();
        }
        let committed: Value = std::fs::read_to_string(CONTRACT)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .expect("missing startup contract fixture; run with UPDATE_CONTRACT=1");
        assert_eq!(
            committed, expected,
            "Rust types changed; rerun with UPDATE_CONTRACT=1 and update startup.ts"
        );
    }
}
