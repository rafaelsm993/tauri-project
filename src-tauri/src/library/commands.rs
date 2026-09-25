use super::events::append_event;
use super::posters;
use super::types::{Event, Length, LibraryEntry, MediaSnapshot, Status, UserData};
use crate::api::types::{MediaItem, MediaType};
use crate::store::writer::StoreHandle;
use crate::store::{current_version, Migration};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

// library.json upgrade steps, oldest first; adding one bumps SCHEMA_VERSION.
pub const MIGRATIONS: &[Migration] = &[];
pub const SCHEMA_VERSION: u32 = current_version(MIGRATIONS);

// The whole library as one file: key → entry.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct LibraryFile {
    #[serde(default)]
    pub entries: BTreeMap<String, LibraryEntry>,
}

// Single owner of library.json, the event log path and the poster cache folder.
#[derive(Clone)]
pub struct LibraryState {
    pub store: Arc<StoreHandle<LibraryFile>>,
    pub events: PathBuf,
    pub posters: PathBuf,
    pub poster_lock: Arc<tokio::sync::Mutex<()>>,
    pub poster_failures: Arc<tokio::sync::Mutex<HashMap<String, Instant>>>,
}

impl LibraryState {
    pub fn new(dir: &std::path::Path, file: LibraryFile) -> Self {
        Self {
            store: StoreHandle::new(dir.join("library.json"), SCHEMA_VERSION, file),
            events: dir.join("events.jsonl"),
            posters: dir.join("posters"),
            poster_lock: Arc::default(),
            poster_failures: Arc::default(),
        }
    }
}

// Fields a caller may patch; absent = leave alone.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct UserPatch {
    pub status: Option<Status>,
    pub progress: Option<u32>,
    pub rating: Option<Option<u8>>,
    pub review: Option<Option<String>>,
    pub length: Option<Length>,
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
    validate_progress(media_type, user.progress)
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
}

fn log_event(state: &LibraryState, event: Option<Event>) -> Result<(), String> {
    match event {
        Some(e) => append_event(&state.events, &e),
        None => Ok(()),
    }
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
    at: String,
    event: Option<Event>,
) -> Result<LibraryEntry, String> {
    validate_user_data(item.media_type, &user)?;
    let snapshot = MediaSnapshot::from_item(item);
    let key = snapshot.media_key.clone();
    if let Some(existing) = state.store.read(|f| f.entries.get(&key).cloned()).await {
        return Ok(existing);
    }
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
        log_event(state, event)?;
    }
    Ok(entry)
}

/// Patches the user fields of an existing entry; unknown key is an error.
pub async fn update(
    state: &LibraryState,
    key: &str,
    patch: UserPatch,
    at: String,
    event: Option<Event>,
) -> Result<LibraryEntry, String> {
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
    log_event(state, event)?;
    Ok(entry)
}

/// Removes an entry and its cached poster; returns false when the key was not there.
pub async fn remove(state: &LibraryState, key: &str, event: Option<Event>) -> Result<bool, String> {
    if !state.store.read(|f| f.entries.contains_key(key)).await {
        return Ok(false);
    }
    let Some(entry) = state.store.commit(|f| Ok(f.entries.remove(key))).await? else {
        return Ok(false);
    };
    log_event(state, event)?;
    if let Some(file) = entry.snapshot.poster_file {
        posters::remove_quietly(&state.posters.join(file));
    }
    Ok(true)
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
    use crate::api::types::{Id, ProviderId};
    use crate::store::file::read_with_recovery;
    use crate::store::file::tests::scratch;
    use crate::store::file::Versioned;

    fn item(media_type: MediaType) -> MediaItem {
        MediaItem {
            first_air_date: Some("2021-10-02".into()),
            ..MediaItem::new(Id::Num(7), "Arcane".into(), media_type, ProviderId::Tmdb)
        }
    }

    fn event(id: &str) -> Event {
        Event {
            id: id.into(),
            kind: "library_add".into(),
            media_key: "tmdb:tv:7".into(),
            at_utc: "2026-09-25T12:00:00Z".into(),
            local_date: "2026-09-25".into(),
            payload: serde_json::Value::Null,
        }
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
            "t1".into(),
            None,
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
            "t1".into(),
            None,
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
        assert!(update(&state, "tmdb:tv:7", patch, "t2".into(), None)
            .await
            .is_err());
        assert!(remove(&state, "tmdb:tv:7", None).await.is_err());
        let entries = load(&state).await;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].user.progress, 0);
        assert_eq!(entries[0].updated_at, "t1");
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
            "t1".into(),
            None,
        )
        .await
        .unwrap();
        std::fs::create_dir_all(&state.posters).unwrap();
        let file = state.posters.join("tmdb_tv_7.jpg");
        std::fs::write(&file, b"jpg").unwrap();
        attach_poster(&state, "tmdb:tv:7", "tmdb_tv_7.jpg").await;
        assert!(remove(&state, "tmdb:tv:7", None).await.unwrap());
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

    #[tokio::test]
    async fn add_writes_the_entry_and_one_event() {
        let dir = scratch("b3-add");
        let state = state_in(&dir);
        let entry = add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            "2026-09-25T12:00:00Z".into(),
            Some(event("e1")),
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
            "t1".into(),
            Some(event("e1")),
        )
        .await
        .unwrap();
        let again = add(
            &state,
            &item(MediaType::Tv),
            UserData::default(),
            "t2".into(),
            Some(event("e2")),
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
            "t1".into(),
            Some(event("e1")),
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
            "2026-09-25T12:00:00Z".into(),
            Some(event("e1")),
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
            "2026-09-25T13:00:00Z".into(),
            Some(event("e2")),
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
            "t".into(),
            None,
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
            "t1".into(),
            None,
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
            "t2".into(),
            None,
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
            "t1".into(),
            Some(event("e1")),
        )
        .await
        .unwrap();
        assert!(remove(&state, "tmdb:tv:7", Some(event("e2")))
            .await
            .unwrap());
        assert!(!remove(&state, "tmdb:tv:7", Some(event("e3")))
            .await
            .unwrap());
        assert!(saved(&dir).entries.is_empty());
        assert_eq!(events_in(&dir).len(), 2);
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
            "2026-09-25T10:00:00Z".into(),
            None,
        )
        .await
        .unwrap();
        let mut game = item(MediaType::Game);
        game.media_key = "rawg:game:1".into();
        add(
            &state,
            &game,
            UserData::default(),
            "2026-09-25T11:00:00Z".into(),
            None,
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
            "t1".into(),
            Some(event("e1")),
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
}
