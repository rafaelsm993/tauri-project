use crate::backup::bundle::Bundle;
use crate::library::commands::{LibraryFile, LibraryState};
use crate::library::events::{read_events, write_events};
use crate::library::types::Event;
use crate::prefs::ipc::PrefsState;
use crate::store::file::write_atomic;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashSet};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportMode {
    Replace,
    Merge,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct ImportReport {
    pub added: usize,
    pub updated: usize,
    pub kept: usize,
    pub removed: usize,
    pub posters: usize,
    pub prefs_restored: bool,
}

// Newer `updated_at` wins per entry (ISO strings compare in time order); nothing is deleted.
pub fn merge(current: &LibraryFile, incoming: &LibraryFile) -> (LibraryFile, ImportReport) {
    let mut out = current.clone();
    let mut report = ImportReport::default();
    for (key, theirs) in &incoming.entries {
        match out.entries.get(key) {
            None => report.added += 1,
            Some(ours) if theirs.updated_at > ours.updated_at => report.updated += 1,
            Some(_) => {
                report.kept += 1;
                continue;
            }
        }
        out.entries.insert(key.clone(), theirs.clone());
    }
    (out, report)
}

pub fn merge_events(current: &[Event], incoming: &[Event]) -> Vec<Event> {
    let seen: HashSet<&str> = current.iter().map(|e| e.id.as_str()).collect();
    let fresh = incoming.iter().filter(|e| !seen.contains(e.id.as_str()));
    current.iter().chain(fresh).cloned().collect()
}

pub fn replace_report(current: &LibraryFile, incoming: &LibraryFile) -> ImportReport {
    let shared = incoming
        .entries
        .keys()
        .filter(|k| current.entries.contains_key(*k))
        .count();
    ImportReport {
        added: incoming.entries.len() - shared,
        updated: shared,
        removed: current.entries.len() - shared,
        ..ImportReport::default()
    }
}

// Writes the carried posters that the resulting library references.
fn write_posters(
    dir: &Path,
    library: &LibraryFile,
    posters: &[(String, Vec<u8>)],
) -> Result<usize, String> {
    let wanted: BTreeSet<&str> = library
        .entries
        .values()
        .filter_map(|e| e.snapshot.poster_file.as_deref())
        .collect();
    std::fs::create_dir_all(dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    let mut written = 0;
    for (name, bytes) in posters.iter().filter(|(n, _)| wanted.contains(n.as_str())) {
        write_atomic(&dir.join(name), bytes)?;
        written += 1;
    }
    Ok(written)
}

// Posters first, then the library (atomic, rolls back), then the log, then prefs on replace.
pub async fn apply(
    library: &LibraryState,
    prefs: &PrefsState,
    bundle: Bundle,
    mode: ImportMode,
) -> Result<ImportReport, String> {
    let _posters = library.poster_lock.lock().await;
    let current = library.store.read(LibraryFile::clone).await;
    let (next, mut report, events) = match mode {
        ImportMode::Replace => {
            let report = replace_report(&current, &bundle.library);
            (bundle.library, report, bundle.events)
        }
        ImportMode::Merge => {
            let (next, report) = merge(&current, &bundle.library);
            let events = merge_events(&read_events(&library.events)?, &bundle.events);
            (next, report, events)
        }
    };
    report.posters = write_posters(&library.posters, &next, &bundle.posters)?;
    library
        .store
        .commit(|f| {
            *f = next;
            Ok(())
        })
        .await?;
    write_events(&library.events, &events)?;
    if mode == ImportMode::Replace {
        let restored = bundle.prefs;
        prefs
            .store
            .commit(|p| {
                *p = restored;
                Ok(())
            })
            .await?;
        report.prefs_restored = true;
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backup::bundle::tests::{entry, library, sample, PNG};
    use crate::library::commands::{load, MIGRATIONS};
    use crate::library::types::tests::event;
    use crate::prefs::{Prefs, SCHEMA_VERSION as PREFS_SCHEMA};
    use crate::store::file::tests::scratch;
    use crate::store::writer::StoreHandle;

    fn fresh(name: &str) -> (std::path::PathBuf, LibraryState, PrefsState) {
        let dir = scratch(name);
        let lib = LibraryState::new(&dir, LibraryFile::default());
        let prefs = PrefsState {
            store: StoreHandle::new(dir.join("prefs.json"), PREFS_SCHEMA, Prefs::default()),
        };
        (dir, lib, prefs)
    }

    #[test]
    fn merge_adds_new_takes_newer_and_keeps_the_rest() {
        let current = library(vec![
            entry(1, "2026-09-10"),
            entry(2, "2026-09-20"),
            entry(3, "2026-09-15"),
        ]);
        let incoming = library(vec![
            entry(1, "2026-09-12"),
            entry(2, "2026-09-18"),
            entry(3, "2026-09-15"),
            entry(4, "2026-09-01"),
        ]);
        let (out, r) = merge(&current, &incoming);
        assert_eq!(out.entries.len(), 4, "nothing is deleted");
        assert_eq!(out.entries["tmdb:movie:1"].updated_at, "2026-09-12");
        assert_eq!(out.entries["tmdb:movie:2"].updated_at, "2026-09-20");
        assert_eq!((r.added, r.updated, r.kept, r.removed), (1, 1, 2, 0));
    }

    #[test]
    fn merge_never_deletes_entries_missing_from_the_backup() {
        let (out, _) = merge(&library(vec![entry(9, "t")]), &library(vec![]));
        assert!(out.entries.contains_key("tmdb:movie:9"));
    }

    #[test]
    fn merged_events_keep_order_and_count_each_id_once() {
        let merged = merge_events(&[event("a"), event("b")], &[event("b"), event("c")]);
        let ids: Vec<String> = merged.into_iter().map(|e| e.id).collect();
        assert_eq!(ids, ["a", "b", "c"]);
    }

    #[test]
    fn replace_report_counts_new_shared_and_dropped() {
        let r = replace_report(
            &library(vec![entry(1, "t"), entry(2, "t")]),
            &library(vec![entry(2, "t"), entry(3, "t")]),
        );
        assert_eq!((r.added, r.updated, r.removed), (1, 1, 1));
    }

    #[tokio::test]
    async fn replace_swaps_library_events_prefs_and_writes_posters() {
        let (dir, lib, prefs) = fresh("apply-replace");
        let r = apply(&lib, &prefs, sample(), ImportMode::Replace)
            .await
            .unwrap();
        assert_eq!((r.added, r.posters, r.prefs_restored), (2, 1, true));
        assert_eq!(load(&lib).await.len(), 2);
        assert_eq!(read_events(&lib.events).unwrap().len(), 2);
        assert!(!crate::prefs::ipc::load(&prefs).await.background_animation);
        let poster = std::fs::read(lib.posters.join("tmdb_movie_1.png")).unwrap();
        assert_eq!(poster, PNG);
        let on_disk = crate::store::load::<LibraryFile>(&dir.join("library.json"), MIGRATIONS)
            .unwrap()
            .unwrap();
        assert_eq!(on_disk.data.entries.len(), 2, "survives a restart");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn merge_keeps_this_devices_settings() {
        let (dir, lib, prefs) = fresh("apply-merge");
        let r = apply(&lib, &prefs, sample(), ImportMode::Merge)
            .await
            .unwrap();
        assert!(!r.prefs_restored);
        assert!(crate::prefs::ipc::load(&prefs).await.background_animation);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
