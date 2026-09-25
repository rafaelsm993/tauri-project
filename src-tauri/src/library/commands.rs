use super::events::append_event;
use super::types::{Event, LibraryEntry, MediaSnapshot, Status, UserData};
use crate::api::types::{MediaItem, MediaType};
use crate::store::writer::StoreHandle;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

pub const SCHEMA_VERSION: u32 = 1;

// The whole library as one file: key → entry.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct LibraryFile {
    #[serde(default)]
    pub entries: BTreeMap<String, LibraryEntry>,
}

// Single owner of library.json plus the path of the append-only event log.
pub struct LibraryState {
    pub store: Arc<StoreHandle<LibraryFile>>,
    pub events: PathBuf,
}

// Fields a caller may patch; absent = leave alone.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct UserPatch {
    pub status: Option<Status>,
    pub progress: Option<u32>,
    pub rating: Option<Option<u8>>,
    pub review: Option<Option<String>>,
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
    let (entry, inserted) = state
        .store
        .update(|f| {
            if let Some(existing) = f.entries.get(&key) {
                return (existing.clone(), false);
            }
            let entry = LibraryEntry {
                key: key.clone(),
                snapshot,
                user,
                created_at: at.clone(),
                updated_at: at,
            };
            f.entries.insert(key.clone(), entry.clone());
            (entry, true)
        })
        .await;
    if inserted {
        log_event(state, event)?;
        state.store.flush().await?;
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
    let media_type = state
        .store
        .read(|f| f.entries.get(key).map(|e| e.snapshot.media_type))
        .await
        .ok_or_else(|| format!("{key} is not in the library"))?;
    let mut candidate = state.store.read(|f| f.entries[key].user.clone()).await;
    apply_patch(&mut candidate, patch);
    validate_user_data(media_type, &candidate)?;
    let entry = state
        .store
        .update(|f| {
            let entry = f.entries.get_mut(key).expect("checked above");
            entry.user = candidate;
            entry.updated_at = at;
            entry.clone()
        })
        .await;
    log_event(state, event)?;
    state.store.flush().await?;
    Ok(entry)
}

/// Removes an entry; returns false when the key was not there.
pub async fn remove(state: &LibraryState, key: &str, event: Option<Event>) -> Result<bool, String> {
    let removed = state
        .store
        .update(|f| f.entries.remove(key).is_some())
        .await;
    if removed {
        log_event(state, event)?;
        state.store.flush().await?;
    }
    Ok(removed)
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

    fn state_in(dir: &std::path::Path) -> LibraryState {
        LibraryState {
            store: StoreHandle::new(
                dir.join("library.json"),
                SCHEMA_VERSION,
                LibraryFile::default(),
            ),
            events: dir.join("events.jsonl"),
        }
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
            },
            "t1".into(),
            Some(event("e1")),
        )
        .await
        .unwrap();

        let file = saved(&dir);
        let reopened = LibraryState {
            store: StoreHandle::new(dir.join("library.json"), SCHEMA_VERSION, file),
            events: dir.join("events.jsonl"),
        };
        let entries = load(&reopened).await;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].user.rating, Some(10));
        assert_eq!(entries[0].user.status, Status::Completed);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
