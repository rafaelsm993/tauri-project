pub mod apply;
pub mod bundle;
pub mod ipc;

use crate::library::commands::{LibraryFile, LibraryState};
use crate::library::events::read_events;
use crate::prefs::ipc::PrefsState;
use bundle::{build, manifest_for, read, Bundle, Limits};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ExportReport {
    pub path: String,
    pub entries: usize,
    pub posters: usize,
    pub bytes: usize,
}

// What the user sees before choosing merge or replace; counts come from the parsed data.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ImportPreview {
    pub created_at: String,
    pub app_version: String,
    pub entries: usize,
    pub events: usize,
    pub posters: usize,
}

impl ImportPreview {
    pub fn of(b: &Bundle) -> Self {
        Self {
            created_at: b.manifest.created_at.clone(),
            app_version: b.manifest.app_version.clone(),
            entries: b.library.entries.len(),
            events: b.events.len(),
            posters: b.posters.len(),
        }
    }
}

pub fn default_name(at: &str) -> String {
    let date = at
        .get(..10)
        .filter(|d| d.as_bytes()[4] == b'-' && d.as_bytes()[7] == b'-');
    date.map_or("aevum-backup.zip".into(), |d| {
        format!("aevum-backup-{d}.zip")
    })
}

pub fn with_zip_ext(path: PathBuf) -> PathBuf {
    let has_zip = path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("zip"));
    if has_zip {
        path
    } else {
        path.with_extension("zip")
    }
}

// Library, log, prefs and the posters on disk, as they are right now.
pub async fn collect(
    library: &LibraryState,
    prefs: &PrefsState,
    created_at: &str,
) -> Result<Bundle, String> {
    let file = library.store.read(LibraryFile::clone).await;
    let events = read_events(&library.events)?;
    let prefs = crate::prefs::ipc::load(prefs).await;
    let mut posters = Vec::new();
    for name in file
        .entries
        .values()
        .filter_map(|e| e.snapshot.poster_file.as_deref())
    {
        match std::fs::read(library.posters.join(name)) {
            Ok(bytes) => posters.push((name.to_string(), bytes)),
            Err(e) => log::warn!("[backup] poster {name} skipped: {e}"),
        }
    }
    let manifest = manifest_for(&file, events.len(), posters.len(), created_at);
    Ok(Bundle {
        manifest,
        library: file,
        events,
        prefs,
        posters,
    })
}

// Writes the backup and reads it back, so a report means the file really imports.
pub async fn export_to(
    path: &Path,
    library: &LibraryState,
    prefs: &PrefsState,
    created_at: &str,
) -> Result<ExportReport, String> {
    let bundle = collect(library, prefs, created_at).await?;
    let bytes = build(&bundle)?;
    crate::store::file::write_atomic(path, &bytes)?;
    load_bundle(path, &Limits::DEFAULT)
        .map_err(|e| format!("the written backup did not verify: {e}"))?;
    Ok(ExportReport {
        path: path.display().to_string(),
        entries: bundle.manifest.entries,
        posters: bundle.manifest.posters,
        bytes: bytes.len(),
    })
}

pub fn load_bundle(path: &Path, limits: &Limits) -> Result<Bundle, String> {
    let size = std::fs::metadata(path)
        .map_err(|e| format!("open {}: {e}", path.display()))?
        .len();
    if size > limits.total_bytes {
        return Err(format!(
            "the file is too large to be an Aevum backup ({size} bytes)"
        ));
    }
    let bytes = std::fs::read(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    read(&bytes, limits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::file::tests::scratch;
    use serde_json::{json, Value};

    #[test]
    fn the_default_name_carries_the_date() {
        assert_eq!(
            default_name("2026-09-26T03:00:00.000Z"),
            "aevum-backup-2026-09-26.zip"
        );
        assert_eq!(default_name("garbage"), "aevum-backup.zip");
        assert_eq!(default_name("x"), "aevum-backup.zip");
    }

    #[test]
    fn a_missing_zip_extension_is_added() {
        assert_eq!(
            with_zip_ext(PathBuf::from("/h/b")),
            PathBuf::from("/h/b.zip")
        );
        assert_eq!(
            with_zip_ext(PathBuf::from("/h/b.ZIP")),
            PathBuf::from("/h/b.ZIP")
        );
    }

    #[tokio::test]
    async fn export_writes_a_verified_bundle_without_secrets() {
        let dir = scratch("export");
        std::fs::write(
            dir.join("prefs.json"),
            br#"{"schema_version":1,"data":{"background_animation":false,"tmdb_api_key":"SECRET-KEY-123"}}"#,
        )
        .unwrap();
        let lib = LibraryState::new(&dir, LibraryFile::default());
        let prefs = crate::prefs::ipc::init(&dir).unwrap();
        let out = dir.join("out.zip");
        let report = export_to(&out, &lib, &prefs, "2026-09-26T00:00:00.000Z")
            .await
            .unwrap();
        assert_eq!(report.entries, 0);
        let mut zip = zip::ZipArchive::new(std::fs::File::open(&out).unwrap()).unwrap();
        for i in 0..zip.len() {
            let mut f = zip.by_index(i).unwrap();
            let mut text = String::new();
            std::io::Read::read_to_string(&mut f, &mut text).ok();
            assert!(!text.contains("SECRET-KEY-123"), "{} leaks a key", f.name());
            assert!(
                !text.to_lowercase().contains("api_key"),
                "{} names a key",
                f.name()
            );
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_file_larger_than_the_limit_is_refused_before_reading() {
        let dir = scratch("too-big");
        let path = dir.join("big.zip");
        std::fs::write(&path, vec![0u8; 10]).unwrap();
        let tiny = Limits {
            total_bytes: 5,
            ..Limits::DEFAULT
        };
        assert!(load_bundle(&path, &tiny).unwrap_err().contains("too large"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    const CONTRACT: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../src/lib/types/backup.contract.fixture.json"
    );

    #[test]
    fn backup_contract_fixture_matches_the_rust_types() {
        let expected = json!({
            "export_report": ExportReport { path: "/h/aevum-backup.zip".into(), entries: 2, posters: 1, bytes: 2048 },
            "import_preview": ImportPreview {
                created_at: "2026-09-26T00:00:00.000Z".into(),
                app_version: "0.1.0".into(),
                entries: 2,
                events: 2,
                posters: 1,
            },
            "import_report": apply::ImportReport::default(),
            "import_modes": [apply::ImportMode::Replace, apply::ImportMode::Merge],
        });
        if std::env::var_os("UPDATE_CONTRACT").is_some() {
            let text = serde_json::to_string_pretty(&expected).unwrap() + "\n";
            std::fs::write(CONTRACT, text).unwrap();
        }
        let committed: Value = std::fs::read_to_string(CONTRACT)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .expect("missing backup contract fixture; run with UPDATE_CONTRACT=1");
        assert_eq!(
            committed, expected,
            "Rust types changed; rerun with UPDATE_CONTRACT=1 and update backup.ts"
        );
    }

    // Run: AEVUM_BACKUP_SRC=/path/to/a/COPY/of/the/data/dir cargo test live_backup -- --ignored --nocapture
    #[tokio::test]
    #[ignore]
    async fn live_backup_round_trips_a_copy_of_real_data() {
        let src = PathBuf::from(std::env::var("AEVUM_BACKUP_SRC").expect("set AEVUM_BACKUP_SRC"));
        let file = crate::store::load::<LibraryFile>(
            &src.join("library.json"),
            crate::library::commands::MIGRATIONS,
        )
        .unwrap()
        .map(|l| l.data)
        .unwrap_or_default();
        let lib = LibraryState::new(&src, file);
        let prefs = crate::prefs::ipc::init(&src).unwrap();
        let out = src.join("live-export.zip");
        let r = export_to(&out, &lib, &prefs, "2026-09-26T00:00:00.000Z")
            .await
            .unwrap();
        let empty = scratch("live-import");
        let l2 = LibraryState::new(&empty, LibraryFile::default());
        let p2 = crate::prefs::ipc::init(&empty).unwrap();
        let bundle = load_bundle(&out, &Limits::DEFAULT).unwrap();
        let got = apply::apply(&l2, &p2, bundle, apply::ImportMode::Merge)
            .await
            .unwrap();
        println!("exported {r:?} -> imported {got:?} -> {}", out.display());
        assert_eq!(got.added, r.entries);
        std::fs::remove_dir_all(&empty).unwrap();
    }
}
