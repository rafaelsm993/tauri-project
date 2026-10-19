use super::events::{append_event, read_events};
use super::manual::{self, ManualDraft};
use super::posters;
use super::reconcile;
use super::types::{
    Event, EventKind, Length, LibraryEntry, MediaSnapshot, Plan, Status, Tombstone, UserData,
};
use crate::api::types::{MediaItem, MediaKey, MediaType, ProviderId};
use crate::store::writer::StoreHandle;
use crate::store::{current_version, Migration};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

// library.json upgrade steps, oldest first; adding one bumps SCHEMA_VERSION.
pub const MIGRATIONS: &[Migration] = &[add_merged];
pub const SCHEMA_VERSION: u32 = current_version(MIGRATIONS);

// v1 → v2: merged-away manual items; an older app must refuse the file, not drop them on save.
fn add_merged(mut v: serde_json::Value) -> Result<serde_json::Value, String> {
    let map = v.as_object_mut().ok_or("library is not an object")?;
    map.entry("merged").or_insert_with(|| serde_json::json!({}));
    Ok(v)
}

// The whole library as one file: key → entry, plus the manual items merged away.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct LibraryFile {
    #[serde(default)]
    pub entries: BTreeMap<String, LibraryEntry>,
    #[serde(default)]
    pub merged: BTreeMap<String, Tombstone>,
}

// Single owner of library.json, the event log path and the poster cache folder.
#[derive(Clone)]
pub struct LibraryState {
    pub store: Arc<StoreHandle<LibraryFile>>,
    pub events: PathBuf,
    pub posters: PathBuf,
    pub poster_lock: Arc<tokio::sync::Mutex<()>>,
    pub poster_failures: Arc<tokio::sync::Mutex<HashMap<String, Instant>>>,
    // Held for every write to the event log, so an import never drops an event appended meanwhile.
    pub events_lock: Arc<tokio::sync::Mutex<()>>,
}

impl LibraryState {
    pub fn new(dir: &std::path::Path, file: LibraryFile) -> Self {
        Self {
            store: StoreHandle::new(dir.join("library.json"), SCHEMA_VERSION, file),
            events: dir.join("events.jsonl"),
            posters: dir.join("posters"),
            poster_lock: Arc::default(),
            poster_failures: Arc::default(),
            events_lock: Arc::default(),
        }
    }
}

// Fields a caller may patch; absent = leave alone, `null` = clear.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct UserPatch {
    pub status: Option<Status>,
    pub progress: Option<u32>,
    #[serde(default, deserialize_with = "crate::store::present")]
    pub rating: Option<Option<u8>>,
    #[serde(default, deserialize_with = "crate::store::present")]
    pub review: Option<Option<String>>,
    pub length: Option<Length>,
    #[serde(default, deserialize_with = "crate::store::present")]
    pub plan: Option<Option<Plan>>,
}

// Days 0–6 once each, 5–720 minutes a session, set on a real `YYYY-MM-DD`.
pub fn validate_plan(plan: &Plan) -> Result<(), String> {
    let mut seen = [false; 7];
    if plan.days.is_empty() {
        return Err("a plan needs at least one day".into());
    }
    for &d in &plan.days {
        let slot = seen
            .get_mut(d as usize)
            .ok_or_else(|| format!("day {d} is not 0–6"))?;
        if std::mem::replace(slot, true) {
            return Err(format!("day {d} is listed twice"));
        }
    }
    if !(5..=720).contains(&plan.max_session_minutes) {
        return Err(format!(
            "{} minutes a session is outside 5–720",
            plan.max_session_minutes
        ));
    }
    if !is_local_date(&plan.since) {
        return Err(format!("{} is not a YYYY-MM-DD date", plan.since));
    }
    Ok(())
}

fn is_local_date(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b.iter().enumerate().all(|(i, c)| {
            if i == 4 || i == 7 {
                *c == b'-'
            } else {
                c.is_ascii_digit()
            }
        })
}

// Ratings are 1–10 whole numbers (GOALS-QA J2); None means unrated.
pub fn validate_rating(rating: Option<u8>) -> Result<(), String> {
    match rating {
        Some(r) if !(1..=10).contains(&r) => Err(format!("rating {r} is outside 1–10")),
        _ => Ok(()),
    }
}

// Progress units per media type (GOALS-QA J3); a movie is only watched or not.
pub fn validate_progress(media_type: MediaType, progress: u32) -> Result<(), String> {
    match media_type {
        MediaType::Movie if progress > 1 => {
            Err("a movie is watched (1) or not (0), not counted".into())
        }
        _ => Ok(()),
    }
}

pub fn validate_user_data(media_type: MediaType, user: &UserData) -> Result<(), String> {
    validate_rating(user.rating)?;
    validate_progress(media_type, user.progress)?;
    user.plan.as_ref().map_or(Ok(()), validate_plan)
}

pub fn apply_patch(user: &mut UserData, patch: UserPatch) {
    if let Some(s) = patch.status {
        user.status = s;
    }
    if let Some(p) = patch.progress {
        user.progress = p;
    }
    if let Some(r) = patch.rating {
        user.rating = r;
    }
    if let Some(r) = patch.review {
        user.review = r;
    }
    if let Some(l) = patch.length {
        user.length = l;
    }
    if let Some(p) = patch.plan {
        user.plan = p;
    }
}

// An event must name the command's key, carry an id and be a kind that command logs.
fn check_event(e: &Event, key: &str, allowed: &[EventKind]) -> Result<(), String> {
    if e.id.is_empty() {
        return Err("event has no id".into());
    }
    if e.media_key != key {
        return Err(format!("event is for {}, not {key}", e.media_key));
    }
    if !allowed.iter().any(|k| k.as_str() == e.kind) {
        return Err(format!("{} is not an event this command logs", e.kind));
    }
    Ok(())
}

// The saved change is the truth; a failed append only costs that action its XP.
async fn log_event(state: &LibraryState, e: Event) {
    let _log = state.events_lock.lock().await;
    if let Err(err) = append_event(&state.events, &e) {
        log::error!("[events] {} not logged: {err}", e.kind);
    }
}

/// The activity log, oldest first, once per event id.
pub fn events(state: &LibraryState) -> Result<Vec<Event>, String> {
    read_events(&state.events)
}

/// All entries, most recently updated first.
pub async fn load(state: &LibraryState) -> Vec<LibraryEntry> {
    state
        .store
        .read(|f| {
            let mut all: Vec<_> = f.entries.values().cloned().collect();
            all.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
            all
        })
        .await
}

/// Inserts an entry for `item`; re-adding an existing key returns the existing one untouched.
pub async fn add(
    state: &LibraryState,
    item: &MediaItem,
    user: UserData,
    event: Event,
) -> Result<LibraryEntry, String> {
    validate_user_data(item.media_type, &user)?;
    let snapshot = MediaSnapshot::from_item(item);
    check_event(&event, &snapshot.media_key, &[EventKind::LibraryAdd])?;
    if let Some(existing) = state
        .store
        .read(|f| f.entries.get(&snapshot.media_key).cloned())
        .await
    {
        return Ok(existing);
    }
    insert(state, snapshot, user, event).await
}

/// Adds a hand-made item under `manual:<type>:<id>`; the event arrives without a key and gets it.
pub async fn add_manual(
    state: &LibraryState,
    id: &str,
    draft: &ManualDraft,
    user: UserData,
    mut event: Event,
) -> Result<LibraryEntry, String> {
    let key = manual::manual_key(draft.media_type, id);
    let snapshot = manual::snapshot(draft, &key)?;
    validate_user_data(draft.media_type, &user)?;
    event.media_key = key.clone();
    check_event(&event, &key, &[EventKind::LibraryAdd])?;
    insert(state, snapshot, user, event).await
}

// Commits a new entry and logs its add; an entry already under the key wins.
async fn insert(
    state: &LibraryState,
    snapshot: MediaSnapshot,
    user: UserData,
    event: Event,
) -> Result<LibraryEntry, String> {
    let key = snapshot.media_key.clone();
    let at = event.at_utc.clone();
    let (entry, inserted) = state
        .store
        .commit(|f| {
            if let Some(existing) = f.entries.get(&key) {
                return Ok((existing.clone(), false));
            }
            let entry = LibraryEntry {
                key: key.clone(),
                snapshot,
                user,
                created_at: at.clone(),
                updated_at: at,
            };
            f.entries.insert(key.clone(), entry.clone());
            Ok((entry, true))
        })
        .await?;
    if inserted {
        log_event(state, event).await;
    }
    Ok(entry)
}

/// Rewrites a manual item's text fields; its type, poster and user data stay.
pub async fn edit_manual(
    state: &LibraryState,
    key: &str,
    draft: &ManualDraft,
    event: Event,
) -> Result<LibraryEntry, String> {
    check_event(&event, key, &[EventKind::LibraryEdit])?;
    let parsed = MediaKey::parse(key)?;
    if parsed.provider != ProviderId::Manual {
        return Err("only manual items can be edited".into());
    }
    if parsed.media_type != draft.media_type {
        return Err("a manual item's type can't change".into());
    }
    let mut snapshot = manual::snapshot(draft, key)?;
    let at = event.at_utc.clone();
    let entry = state
        .store
        .commit(|f| {
            let entry = f
                .entries
                .get_mut(key)
                .ok_or_else(|| format!("{key} is not in the library"))?;
            snapshot.poster_path = entry.snapshot.poster_path.take();
            snapshot.poster_file = entry.snapshot.poster_file.take();
            entry.snapshot = snapshot;
            entry.updated_at = at;
            Ok(entry.clone())
        })
        .await?;
    log_event(state, event).await;
    Ok(entry)
}

/// Patches the user fields of an existing entry; unknown key is an error.
pub async fn update(
    state: &LibraryState,
    key: &str,
    patch: UserPatch,
    event: Event,
) -> Result<LibraryEntry, String> {
    check_event(
        &event,
        key,
        &[EventKind::LibraryUpdate, EventKind::LibraryPlan],
    )?;
    let at = event.at_utc.clone();
    let entry = state
        .store
        .commit(|f| {
            let entry = f
                .entries
                .get_mut(key)
                .ok_or_else(|| format!("{key} is not in the library"))?;
            let mut user = entry.user.clone();
            apply_patch(&mut user, patch);
            validate_user_data(entry.snapshot.media_type, &user)?;
            entry.user = user;
            entry.updated_at = at;
            Ok(entry.clone())
        })
        .await?;
    log_event(state, event).await;
    Ok(entry)
}

/// Removes an entry and its cached poster; returns false when the key was not there.
pub async fn remove(state: &LibraryState, key: &str, event: Event) -> Result<bool, String> {
    check_event(&event, key, &[EventKind::LibraryRemove])?;
    if !state.store.read(|f| f.entries.contains_key(key)).await {
        return Ok(false);
    }
    let Some(entry) = state.store.commit(|f| Ok(f.entries.remove(key))).await? else {
        return Ok(false);
    };
    log_event(state, event).await;
    if let Some(file) = entry.snapshot.poster_file {
        posters::remove_quietly(&state.posters.join(file));
    }
    Ok(true)
}

// What a merge would save, for the side-by-side step; writes nothing.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MergePreview {
    pub entry: LibraryEntry,
    pub combined: bool,
}

pub async fn merge_preview(
    state: &LibraryState,
    key: &str,
    item: &MediaItem,
    catalog: &Length,
) -> Result<MergePreview, String> {
    state
        .store
        .read(|f| {
            let plan = reconcile::plan_merge(f, key, item, catalog, "")?;
            Ok(MergePreview {
                combined: plan.tombstone.existing.is_some(),
                entry: plan.entry,
            })
        })
        .await
}

/// Replaces a manual item with its catalog match in one write, then logs `library_merge`.
pub async fn merge(
    state: &LibraryState,
    key: &str,
    item: &MediaItem,
    catalog: &Length,
    mut event: Event,
) -> Result<LibraryEntry, String> {
    check_event(&event, key, &[EventKind::LibraryMerge])?;
    let at = event.at_utc.clone();
    let entry = state
        .store
        .commit(|f| {
            let plan = reconcile::plan_merge(f, key, item, catalog, &at)?;
            let entry = plan.entry.clone();
            reconcile::apply_merge(f, key, plan);
            Ok(entry)
        })
        .await?;
    event.payload = serde_json::json!({ "into": entry.key });
    log_event(state, event).await;
    Ok(entry)
}

/// Undoes a merge in one write, then logs `library_unmerge`; returns the manual entry.
pub async fn unmerge(
    state: &LibraryState,
    key: &str,
    mut event: Event,
) -> Result<LibraryEntry, String> {
    check_event(&event, key, &[EventKind::LibraryUnmerge])?;
    let t = state.store.commit(|f| reconcile::unmerge(f, key)).await?;
    event.payload = serde_json::json!({ "into": t.into });
    log_event(state, event).await;
    Ok(t.entry)
}

/// Manual key → catalog key for every merge saved in the library file.
pub async fn aliases(state: &LibraryState) -> BTreeMap<String, String> {
    state.store.read(reconcile::aliases).await
}

/// Records a downloaded poster; false when the entry was removed meanwhile.
pub async fn attach_poster(state: &LibraryState, key: &str, file: &str) -> bool {
    let attached = state
        .store
        .update(|f| match f.entries.get_mut(key) {
            Some(e) => {
                e.snapshot.poster_file = Some(file.to_string());
                true
            }
            None => false,
        })
        .await;
    if attached {
        if let Err(e) = state.store.flush().await {
            log::warn!("[posters] flush after attach: {e}");
        }
    }
    attached
}

pub async fn poster_files(state: &LibraryState) -> BTreeSet<String> {
    state
        .store
        .read(|f| {
            f.entries
                .values()
                .filter_map(|e| e.snapshot.poster_file.clone())
                .collect()
        })
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::types::Id;
    use crate::library::manual::ManualDraft;
    use crate::store::file::read_with_recovery;
    use crate::store::file::tests::scratch;
    use crate::store::file::Versioned;

    fn item(media_type: MediaType) -> MediaItem {
        MediaItem {
            first_air_date: Some("2021-10-02".into()),
            ..MediaItem::new(Id::Num(7), "Arcane".into(), media_type, ProviderId::Tmdb)
        }
    }

    fn ev(kind: &str, key: &str, id: &str, at: &str) -> Event {
        Event {
            id: id.into(),
            kind: kind.into(),
            media_key: key.into(),
            at_utc: at.into(),
            local_date: "2026-09-25".into(),
            payload: serde_json::Value::Null,
        }
    }

    fn event(id: &str) -> Event {
        ev("library_add", "tmdb:tv:7", id, "2026-09-25T12:00:00Z")
    }

    #[test]
    fn a_patch_can_set_length_without_touching_other_fields() {
        let mut user = UserData {
            progress: 4,
            rating: Some(7),
            ..UserData::default()
        };
        let patch = UserPatch {
            length: Some(Length {
                pages: Some(320),
                ..Length::default()
            }),
            ..UserPatch::default()
        };
        apply_patch(&mut user, patch);
        assert_eq!(user.length.pages, Some(320));
        assert_eq!(user.progress, 4);
        assert_eq!(user.rating, Some(7));
    }

    fn state_in(dir: &std::path::Path) -> LibraryState {
        LibraryState::new(dir, LibraryFile::default())
    }

    #[tokio::test]
    async fn attach_poster_records_the_file_and_ignores_a_removed_entry() {
        let dir = scratch("c6-attach");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "add", "t1"),
        )
        .await
        .unwrap();
        assert!(attach_poster(&state, "tmdb:tv:7", "tmdb_tv_7.jpg").await);
        assert!(!attach_poster(&state, "tmdb:tv:404", "x.jpg").await);
        let entry = &saved(&dir).entries["tmdb:tv:7"];
        assert_eq!(entry.snapshot.poster_file.as_deref(), Some("tmdb_tv_7.jpg"));
        assert_eq!(entry.updated_at, "t1");
        assert_eq!(
            poster_files(&state).await,
            ["tmdb_tv_7.jpg".to_string()].into()
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_failed_write_rolls_the_command_back() {
        let dir = scratch("commit-rollback");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "add", "t1"),
        )
        .await
        .unwrap();
        let path = dir.join("library.json");
        std::fs::remove_file(&path).unwrap();
        std::fs::create_dir_all(&path).unwrap();
        let patch = UserPatch {
            progress: Some(3),
            ..UserPatch::default()
        };
        assert!(update(
            &state,
            "tmdb:tv:7",
            patch,
            ev("library_update", "tmdb:tv:7", "upd", "t2")
        )
        .await
        .is_err());
        assert!(remove(
            &state,
            "tmdb:tv:7",
            ev("library_remove", "tmdb:tv:7", "rm", "t9")
        )
        .await
        .is_err());
        let entries = load(&state).await;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].user.progress, 0);
        assert_eq!(entries[0].updated_at, "t1");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_failed_log_append_keeps_the_saved_change() {
        let dir = scratch("b1-log-fails");
        let state = state_in(&dir);
        std::fs::create_dir_all(&state.events).unwrap();
        let added = add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "a", "t1"),
        )
        .await;
        assert!(added.is_ok(), "{added:?}");
        let patch = UserPatch {
            progress: Some(3),
            ..UserPatch::default()
        };
        let updated = update(
            &state,
            "tmdb:tv:7",
            patch,
            ev("library_update", "tmdb:tv:7", "b", "t2"),
        )
        .await;
        assert_eq!(updated.map(|e| e.user.progress), Ok(3));
        assert_eq!(saved(&dir).entries["tmdb:tv:7"].user.progress, 3);
        assert_eq!(
            remove(
                &state,
                "tmdb:tv:7",
                ev("library_remove", "tmdb:tv:7", "c", "t9")
            )
            .await,
            Ok(true)
        );
        assert!(saved(&dir).entries.is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    const PIRANESI: &str = "itunes:book:42";

    fn piranesi() -> MediaItem {
        MediaItem::new(
            Id::Num(42),
            "Piranesi".into(),
            MediaType::Book,
            ProviderId::Itunes,
        )
    }

    fn pages(n: u32) -> Length {
        Length {
            pages: Some(n),
            ..Length::default()
        }
    }

    async fn manual_book(state: &LibraryState, progress: u32) -> String {
        let draft = ManualDraft {
            media_type: MediaType::Book,
            title: "piranesi".into(),
            creator: None,
            year: None,
            overview: None,
            genres: Vec::new(),
            platforms: Vec::new(),
        };
        let user = UserData {
            status: Status::InProgress,
            progress,
            ..UserData::default()
        };
        add_manual(
            state,
            "m1",
            &draft,
            user,
            ev("library_add", "", "add", "t1"),
        )
        .await
        .unwrap()
        .key
    }

    #[tokio::test]
    async fn merge_saves_the_swap_and_logs_one_event_naming_both_keys() {
        let dir = scratch("f3-merge");
        let state = state_in(&dir);
        let key = manual_book(&state, 30).await;
        let entry = merge(
            &state,
            &key,
            &piranesi(),
            &pages(320),
            ev("library_merge", &key, "m", "t2"),
        )
        .await
        .unwrap();
        assert_eq!((entry.key.as_str(), entry.user.progress), (PIRANESI, 30));
        let file = saved(&dir);
        assert_eq!(file.entries.keys().collect::<Vec<_>>(), [PIRANESI]);
        assert_eq!(file.merged[&key].into, PIRANESI);
        let log = events_in(&dir);
        assert_eq!(log.last().map(|e| e.kind.as_str()), Some("library_merge"));
        assert_eq!(
            log.last().unwrap().payload,
            serde_json::json!({ "into": PIRANESI })
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_refused_merge_writes_nothing_and_logs_nothing() {
        let dir = scratch("f3-refused");
        let state = state_in(&dir);
        let key = manual_book(&state, 380).await;
        let before = saved(&dir);
        let err = merge(
            &state,
            &key,
            &piranesi(),
            &pages(320),
            ev("library_merge", &key, "m", "t2"),
        )
        .await
        .unwrap_err();
        assert!(err.starts_with("Your progress (380 pages)"), "{err}");
        assert_eq!(saved(&dir), before);
        assert_eq!(events_in(&dir).len(), 1, "only the add");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_merge_whose_event_is_lost_still_links_the_two_keys() {
        let dir = scratch("f3-log-fails");
        let state = state_in(&dir);
        let key = manual_book(&state, 30).await;
        std::fs::remove_file(&state.events).unwrap();
        std::fs::create_dir_all(&state.events).unwrap();
        let merged = merge(
            &state,
            &key,
            &piranesi(),
            &pages(320),
            ev("library_merge", &key, "m", "t2"),
        )
        .await;
        assert!(merged.is_ok(), "{merged:?}");
        assert_eq!(
            aliases(&state).await,
            [(key.clone(), PIRANESI.to_string())].into()
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn preview_shows_the_result_and_writes_nothing() {
        let dir = scratch("f3-preview");
        let state = state_in(&dir);
        let key = manual_book(&state, 30).await;
        let before = saved(&dir);
        let p = merge_preview(&state, &key, &piranesi(), &pages(320))
            .await
            .unwrap();
        assert_eq!((p.entry.key.as_str(), p.combined), (PIRANESI, false));
        assert_eq!(p.entry.user.length.pages, Some(320));
        assert_eq!(saved(&dir), before);
        assert_eq!(load(&state).await.len(), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn unmerge_brings_the_manual_item_back_and_logs_it() {
        let dir = scratch("f3-unmerge");
        let state = state_in(&dir);
        let key = manual_book(&state, 30).await;
        let before = saved(&dir);
        merge(
            &state,
            &key,
            &piranesi(),
            &pages(320),
            ev("library_merge", &key, "m", "t2"),
        )
        .await
        .unwrap();
        let back = unmerge(&state, &key, ev("library_unmerge", &key, "u", "t3"))
            .await
            .unwrap();
        assert_eq!(back.key, key);
        assert_eq!(saved(&dir), before);
        assert!(aliases(&state).await.is_empty());
        let log = events_in(&dir);
        assert_eq!(log.last().map(|e| e.kind.as_str()), Some("library_unmerge"));
        assert_eq!(
            log.last().unwrap().payload,
            serde_json::json!({ "into": PIRANESI })
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn merge_and_unmerge_only_accept_their_own_event() {
        let dir = scratch("f3-events");
        let state = state_in(&dir);
        let key = manual_book(&state, 0).await;
        let wrong = ev("library_update", &key, "x", "t2");
        assert!(merge(&state, &key, &piranesi(), &pages(1), wrong.clone())
            .await
            .is_err());
        assert!(unmerge(&state, &key, wrong).await.is_err());
        assert_eq!(saved(&dir).entries.len(), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn remove_deletes_the_poster_file() {
        let dir = scratch("c6-remove");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "add", "t1"),
        )
        .await
        .unwrap();
        std::fs::create_dir_all(&state.posters).unwrap();
        let file = state.posters.join("tmdb_tv_7.jpg");
        std::fs::write(&file, b"jpg").unwrap();
        attach_poster(&state, "tmdb:tv:7", "tmdb_tv_7.jpg").await;
        assert!(remove(
            &state,
            "tmdb:tv:7",
            ev("library_remove", "tmdb:tv:7", "rm", "t9")
        )
        .await
        .unwrap());
        assert!(!file.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn saved(dir: &std::path::Path) -> LibraryFile {
        let file: Versioned<LibraryFile> = read_with_recovery(&dir.join("library.json"))
            .unwrap()
            .expect("library.json was never written");
        assert_eq!(file.schema_version, SCHEMA_VERSION);
        file.data
    }

    fn events_in(dir: &std::path::Path) -> Vec<Event> {
        crate::library::events::read_events(&dir.join("events.jsonl")).unwrap()
    }

    #[tokio::test]
    async fn events_returns_the_log_oldest_first_and_once_per_id() {
        let dir = scratch("d1-events");
        let state = state_in(&dir);
        assert!(
            events(&state).unwrap().is_empty(),
            "no log yet is an empty list"
        );
        let tv = item(MediaType::Tv);
        add(
            &state,
            &tv,
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "a", "t1"),
        )
        .await
        .unwrap();
        let patch = UserPatch {
            progress: Some(3),
            ..UserPatch::default()
        };
        update(
            &state,
            "tmdb:tv:7",
            patch,
            ev("library_update", "tmdb:tv:7", "b", "t2"),
        )
        .await
        .unwrap();
        crate::library::events::append_event(&state.events, &event("a")).unwrap();
        let ids: Vec<_> = events(&state).unwrap().into_iter().map(|e| e.id).collect();
        assert_eq!(ids, ["a", "b"]);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn ratings_outside_one_to_ten_are_rejected() {
        assert!(validate_rating(Some(0)).is_err());
        assert!(validate_rating(Some(11)).is_err());
        assert!(validate_rating(Some(1)).is_ok());
        assert!(validate_rating(Some(10)).is_ok());
        assert!(validate_rating(None).is_ok());
    }

    #[test]
    fn progress_follows_the_unit_of_the_media_type() {
        assert!(validate_progress(MediaType::Movie, 2).is_err());
        assert!(validate_progress(MediaType::Movie, 1).is_ok());
        assert!(validate_progress(MediaType::Tv, 12).is_ok());
        assert!(validate_progress(MediaType::Book, 350).is_ok());
        assert!(validate_progress(MediaType::Game, 74).is_ok());
    }

    fn plan(days: &[u8], minutes: u32, since: &str) -> Plan {
        Plan {
            days: days.to_vec(),
            max_session_minutes: minutes,
            since: since.into(),
        }
    }

    #[test]
    fn a_plan_needs_real_days_a_sane_length_and_a_date() {
        assert!(validate_plan(&plan(&[0, 2, 4], 60, "2026-10-01")).is_ok());
        assert!(validate_plan(&plan(&[6], 5, "2026-10-01")).is_ok());
        assert!(validate_plan(&plan(&[0], 720, "2026-10-01")).is_ok());
        for bad in [
            plan(&[], 60, "2026-10-01"),
            plan(&[7], 60, "2026-10-01"),
            plan(&[1, 1], 60, "2026-10-01"),
            plan(&[0], 4, "2026-10-01"),
            plan(&[0], 721, "2026-10-01"),
            plan(&[0], 60, "tomorrow"),
            plan(&[0], 60, "2026-10-01T00:00"),
        ] {
            assert!(validate_plan(&bad).is_err(), "{bad:?} should be rejected");
        }
    }

    #[test]
    fn a_patch_sets_and_clears_the_plan() {
        let mut user = UserData {
            progress: 4,
            ..UserData::default()
        };
        let p = plan(&[0, 2], 45, "2026-10-01");
        apply_patch(
            &mut user,
            UserPatch {
                plan: Some(Some(p.clone())),
                ..UserPatch::default()
            },
        );
        assert_eq!(user.plan, Some(p));
        assert_eq!(user.progress, 4);
        apply_patch(&mut user, UserPatch::default());
        assert!(user.plan.is_some(), "an absent field leaves the plan alone");
        apply_patch(
            &mut user,
            UserPatch {
                plan: Some(None),
                ..UserPatch::default()
            },
        );
        assert_eq!(user.plan, None);
    }

    #[test]
    fn a_null_plan_in_json_clears_it_and_a_missing_one_is_left_alone() {
        let clear: UserPatch = serde_json::from_value(serde_json::json!({ "plan": null })).unwrap();
        assert_eq!(clear.plan, Some(None));
        let absent: UserPatch = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(absent.plan, None);
    }

    #[test]
    fn a_null_rating_or_review_in_json_clears_it() {
        let clear: UserPatch =
            serde_json::from_value(serde_json::json!({ "rating": null, "review": null })).unwrap();
        assert_eq!(clear.rating, Some(None));
        assert_eq!(clear.review, Some(None));
        let set: UserPatch = serde_json::from_value(serde_json::json!({ "rating": 7 })).unwrap();
        assert_eq!(set.rating, Some(Some(7)));
        assert_eq!(set.review, None);
    }

    #[tokio::test]
    async fn update_with_an_invalid_plan_changes_nothing() {
        let dir = scratch("e3-bad-plan");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "add", "t1"),
        )
        .await
        .unwrap();
        let patch = UserPatch {
            plan: Some(Some(plan(&[], 60, "2026-10-01"))),
            ..UserPatch::default()
        };
        assert!(update(
            &state,
            "tmdb:tv:7",
            patch,
            ev("library_plan", "tmdb:tv:7", "p", "t2")
        )
        .await
        .is_err());
        let entry = &saved(&dir).entries["tmdb:tv:7"];
        assert_eq!(entry.user.plan, None);
        assert_eq!(entry.updated_at, "t1");
        assert_eq!(events_in(&dir).len(), 1, "only the add is logged");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn add_writes_the_entry_and_one_event() {
        let dir = scratch("b3-add");
        let state = state_in(&dir);
        let entry = add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "e1", "2026-09-25T12:00:00Z"),
        )
        .await
        .unwrap();
        assert_eq!(entry.key, "tmdb:tv:7");
        assert_eq!(entry.created_at, entry.updated_at);
        assert_eq!(saved(&dir).entries.len(), 1);
        assert_eq!(events_in(&dir).len(), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn adding_the_same_key_twice_changes_nothing() {
        let dir = scratch("b3-add2");
        let state = state_in(&dir);
        let used = UserData {
            progress: 3,
            ..UserData::default()
        };
        add(
            &state,
            &item(MediaType::Tv),
            used,
            ev("library_add", "tmdb:tv:7", "e1", "t1"),
        )
        .await
        .unwrap();
        let again = add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "e2", "t2"),
        )
        .await
        .unwrap();
        assert_eq!(again.user.progress, 3, "the second add must not overwrite");
        assert_eq!(saved(&dir).entries.len(), 1);
        assert_eq!(events_in(&dir).len(), 1, "no event for a no-op add");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn add_rejects_an_invalid_rating_and_writes_nothing() {
        let dir = scratch("b3-badrating");
        let state = state_in(&dir);
        let user = UserData {
            rating: Some(11),
            ..UserData::default()
        };
        let err = add(
            &state,
            &item(MediaType::Tv),
            user,
            ev("library_add", "tmdb:tv:7", "e1", "t1"),
        )
        .await
        .unwrap_err();
        assert!(err.contains("1–10"), "{err}");
        assert!(!dir.join("library.json").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn update_patches_only_the_given_fields() {
        let dir = scratch("b3-update");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "e1", "2026-09-25T12:00:00Z"),
        )
        .await
        .unwrap();
        let patched = update(
            &state,
            "tmdb:tv:7",
            UserPatch {
                status: Some(Status::InProgress),
                progress: Some(5),
                ..UserPatch::default()
            },
            ev("library_update", "tmdb:tv:7", "e2", "2026-09-25T13:00:00Z"),
        )
        .await
        .unwrap();
        assert_eq!(patched.user.status, Status::InProgress);
        assert_eq!(patched.user.progress, 5);
        assert_eq!(patched.user.rating, None, "untouched field stays");
        assert_eq!(patched.created_at, "2026-09-25T12:00:00Z");
        assert_eq!(patched.updated_at, "2026-09-25T13:00:00Z");
        assert_eq!(events_in(&dir).len(), 2);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn update_on_a_missing_key_errors() {
        let dir = scratch("b3-missing");
        let state = state_in(&dir);
        let err = update(
            &state,
            "tmdb:tv:999",
            UserPatch::default(),
            ev("library_update", "tmdb:tv:999", "upd", "t"),
        )
        .await
        .unwrap_err();
        assert!(err.contains("not in the library"), "{err}");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn update_rejects_progress_that_breaks_the_unit() {
        let dir = scratch("b3-badprogress");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Movie),
            UserData::default(),
            ev("library_add", "tmdb:movie:7", "add", "t1"),
        )
        .await
        .unwrap();
        let err = update(
            &state,
            "tmdb:movie:7",
            UserPatch {
                progress: Some(2),
                ..UserPatch::default()
            },
            ev("library_update", "tmdb:movie:7", "upd", "t2"),
        )
        .await
        .unwrap_err();
        assert!(err.contains("watched"), "{err}");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn remove_deletes_once() {
        let dir = scratch("b3-remove");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "e1", "t1"),
        )
        .await
        .unwrap();
        assert!(remove(
            &state,
            "tmdb:tv:7",
            ev("library_remove", "tmdb:tv:7", "e2", "t9")
        )
        .await
        .unwrap());
        assert!(!remove(
            &state,
            "tmdb:tv:7",
            ev("library_remove", "tmdb:tv:7", "e3", "t9")
        )
        .await
        .unwrap());
        assert!(saved(&dir).entries.is_empty());
        assert_eq!(events_in(&dir).len(), 2);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn bad(kind: &str, key: &str, id: &str) -> Event {
        Event {
            id: id.into(),
            kind: kind.into(),
            media_key: key.into(),
            ..event("x")
        }
    }

    #[tokio::test]
    async fn an_event_that_does_not_fit_the_command_is_refused_and_nothing_changes() {
        let dir = scratch("w3-event-check");
        let state = state_in(&dir);
        let tv = item(MediaType::Tv);
        let user = UserData::default;
        for e in [
            bad("library_add", "tmdb:tv:8", "a"),
            bad("library_zap", "tmdb:tv:7", "a"),
            bad("library_update", "tmdb:tv:7", "a"),
            bad("library_add", "tmdb:tv:7", ""),
        ] {
            let res = add(&state, &tv, user(), e.clone()).await;
            assert!(res.is_err(), "add accepted {e:?}");
        }
        assert!(!dir.join("library.json").exists());
        add(
            &state,
            &tv,
            user(),
            ev("library_add", "tmdb:tv:7", "ok", "t1"),
        )
        .await
        .unwrap();
        for e in [
            bad("library_update", "tmdb:tv:8", "b"),
            bad("library_remove", "tmdb:tv:7", "b"),
            bad("library_update", "tmdb:tv:7", ""),
        ] {
            let patch = UserPatch {
                progress: Some(3),
                ..UserPatch::default()
            };
            let res = update(&state, "tmdb:tv:7", patch, e.clone()).await;
            assert!(res.is_err(), "update accepted {e:?}");
        }
        for e in [
            bad("library_remove", "tmdb:tv:8", "c"),
            bad("library_add", "tmdb:tv:7", "c"),
            bad("library_remove", "tmdb:tv:7", ""),
        ] {
            let res = remove(&state, "tmdb:tv:7", e.clone()).await;
            assert!(res.is_err(), "remove accepted {e:?}");
        }
        let entry = &saved(&dir).entries["tmdb:tv:7"];
        assert_eq!(entry.user.progress, 0);
        assert_eq!(events_in(&dir).len(), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn load_returns_the_most_recently_updated_first() {
        let dir = scratch("b3-load");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            ev("library_add", "tmdb:tv:7", "add", "2026-09-25T10:00:00Z"),
        )
        .await
        .unwrap();
        let mut game = item(MediaType::Game);
        game.media_key = "rawg:game:1".into();
        add(
            &state,
            &game,
            UserData::default(),
            ev("library_add", "rawg:game:1", "add", "2026-09-25T11:00:00Z"),
        )
        .await
        .unwrap();
        let keys: Vec<_> = load(&state).await.into_iter().map(|e| e.key).collect();
        assert_eq!(keys, ["rawg:game:1", "tmdb:tv:7"]);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_reopened_store_sees_what_was_saved() {
        let dir = scratch("b3-reopen");
        let first = state_in(&dir);
        add(
            &first,
            &item(MediaType::Tv),
            UserData {
                status: Status::Completed,
                progress: 9,
                rating: Some(10),
                review: Some("Great".into()),
                ..UserData::default()
            },
            ev("library_add", "tmdb:tv:7", "e1", "t1"),
        )
        .await
        .unwrap();

        let file = saved(&dir);
        let reopened = LibraryState::new(&dir, file);
        let entries = load(&reopened).await;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].user.rating, Some(10));
        assert_eq!(entries[0].user.status, Status::Completed);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    const ID: &str = "0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";
    const BOOK_KEY: &str = "manual:book:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";

    fn dune() -> ManualDraft {
        ManualDraft {
            creator: Some("Frank Herbert".into()),
            genres: vec!["Sci-fi".into()],
            ..crate::library::manual::tests::draft(MediaType::Book, "Dune")
        }
    }

    // The frontend can't know the new key, so it sends the event without one.
    fn unkeyed(kind: &str, id: &str, at: &str) -> Event {
        ev(kind, "", id, at)
    }

    #[tokio::test]
    async fn add_manual_stores_the_draft_under_a_manual_key_and_logs_an_add() {
        let dir = scratch("f1-add-manual");
        let state = state_in(&dir);
        let user = UserData {
            status: Status::InProgress,
            ..UserData::default()
        };
        let entry = add_manual(&state, ID, &dune(), user, unkeyed("library_add", "a", "t1"))
            .await
            .unwrap();
        assert_eq!(entry.key, BOOK_KEY);
        assert_eq!(entry.snapshot.provider, ProviderId::Manual);
        assert_eq!(entry.snapshot.creator.as_deref(), Some("Frank Herbert"));
        assert_eq!(entry.user.status, Status::InProgress);
        assert_eq!(entry.created_at, "t1");
        assert_eq!(saved(&dir).entries[BOOK_KEY], entry);
        let log = events_in(&dir);
        assert_eq!(log.len(), 1);
        assert_eq!(
            (log[0].kind.as_str(), log[0].media_key.as_str()),
            ("library_add", BOOK_KEY)
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn two_manual_adds_with_the_same_title_are_two_entries() {
        let dir = scratch("f1-add-twice");
        let state = state_in(&dir);
        for (id, ev_id) in [(ID, "a"), ("1c2d3e4f-0000-4000-8000-000000000000", "b")] {
            add_manual(
                &state,
                id,
                &dune(),
                UserData::default(),
                unkeyed("library_add", ev_id, "t1"),
            )
            .await
            .unwrap();
        }
        assert_eq!(load(&state).await.len(), 2);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn an_invalid_manual_draft_or_event_writes_nothing() {
        let dir = scratch("f1-add-invalid");
        let state = state_in(&dir);
        let blank = crate::library::manual::tests::draft(MediaType::Book, " ");
        let no_title = add_manual(
            &state,
            ID,
            &blank,
            UserData::default(),
            unkeyed("library_add", "a", "t1"),
        )
        .await;
        assert!(no_title.unwrap_err().contains("title"));
        let wrong_kind = add_manual(
            &state,
            ID,
            &dune(),
            UserData::default(),
            unkeyed("library_update", "a", "t1"),
        )
        .await;
        assert!(wrong_kind.is_err());
        let bad_user = UserData {
            rating: Some(11),
            ..UserData::default()
        };
        assert!(add_manual(
            &state,
            ID,
            &dune(),
            bad_user,
            unkeyed("library_add", "a", "t1")
        )
        .await
        .is_err());
        assert!(load(&state).await.is_empty());
        assert!(events(&state).unwrap().is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn edit_manual_replaces_the_text_and_keeps_poster_and_user_data() {
        let dir = scratch("f1-edit");
        let state = state_in(&dir);
        let user = UserData {
            progress: 40,
            ..UserData::default()
        };
        add_manual(&state, ID, &dune(), user, unkeyed("library_add", "a", "t1"))
            .await
            .unwrap();
        attach_poster(&state, BOOK_KEY, "mine.jpg").await;
        let changed = ManualDraft {
            year: Some("1965".into()),
            genres: vec![],
            ..crate::library::manual::tests::draft(MediaType::Book, "Dune Messiah")
        };
        let entry = edit_manual(
            &state,
            BOOK_KEY,
            &changed,
            ev("library_edit", BOOK_KEY, "e", "t2"),
        )
        .await
        .unwrap();
        assert_eq!(entry.snapshot.title, "Dune Messiah");
        assert_eq!(entry.snapshot.year.as_deref(), Some("1965"));
        assert_eq!(entry.snapshot.creator, None);
        assert!(entry.snapshot.genres.is_empty());
        assert_eq!(entry.snapshot.poster_file.as_deref(), Some("mine.jpg"));
        assert_eq!(entry.user.progress, 40);
        assert_eq!(
            (entry.created_at.as_str(), entry.updated_at.as_str()),
            ("t1", "t2")
        );
        assert_eq!(saved(&dir).entries[BOOK_KEY], entry);
        assert_eq!(
            events_in(&dir).last().map(|e| e.kind.as_str()),
            Some("library_edit")
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn edit_manual_refuses_provider_items_type_changes_and_missing_keys() {
        let dir = scratch("f1-edit-refused");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            event("p"),
        )
        .await
        .unwrap();
        add_manual(
            &state,
            ID,
            &dune(),
            UserData::default(),
            unkeyed("library_add", "a", "t1"),
        )
        .await
        .unwrap();
        let before = saved(&dir);
        let provider = crate::library::manual::tests::draft(MediaType::Tv, "Hacked");
        let err = edit_manual(
            &state,
            "tmdb:tv:7",
            &provider,
            ev("library_edit", "tmdb:tv:7", "e1", "t2"),
        )
        .await;
        assert!(err.unwrap_err().contains("only manual"));
        let as_movie = crate::library::manual::tests::draft(MediaType::Movie, "Dune");
        let err = edit_manual(
            &state,
            BOOK_KEY,
            &as_movie,
            ev("library_edit", BOOK_KEY, "e2", "t2"),
        )
        .await;
        assert!(err.unwrap_err().contains("type"));
        let gone = "manual:book:ffffffff-ffff-4fff-8fff-ffffffffffff";
        let err = edit_manual(&state, gone, &dune(), ev("library_edit", gone, "e3", "t2")).await;
        assert!(err.unwrap_err().contains("not in the library"));
        let blank = crate::library::manual::tests::draft(MediaType::Book, "");
        assert!(edit_manual(
            &state,
            BOOK_KEY,
            &blank,
            ev("library_edit", BOOK_KEY, "e4", "t2")
        )
        .await
        .is_err());
        let wrong_kind = edit_manual(
            &state,
            BOOK_KEY,
            &dune(),
            ev("library_update", BOOK_KEY, "e5", "t2"),
        )
        .await;
        assert!(wrong_kind.is_err());
        assert_eq!(saved(&dir), before);
        assert_eq!(events_in(&dir).len(), 2, "only the two adds are logged");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn update_does_not_accept_an_edit_event() {
        let dir = scratch("f1-update-no-edit");
        let state = state_in(&dir);
        add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            event("p"),
        )
        .await
        .unwrap();
        let r = update(
            &state,
            "tmdb:tv:7",
            UserPatch::default(),
            ev("library_edit", "tmdb:tv:7", "u", "t2"),
        )
        .await;
        assert!(r.is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
