use crate::api::types::{MediaItem, MediaType, ProviderId};
use serde::{Deserialize, Serialize};

// Where the user is with an item.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    #[default]
    Planning,
    InProgress,
    Completed,
    Dropped,
}

// Owned copy of the provider fields a library card needs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MediaSnapshot {
    pub media_key: String,
    pub provider: ProviderId,
    pub media_type: MediaType,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub poster_path: Option<String>,
    #[serde(default)]
    pub poster_file: Option<String>,
    #[serde(default)]
    pub year: Option<String>,
}

impl MediaSnapshot {
    pub fn from_item(item: &MediaItem) -> Self {
        let date = item
            .release_date
            .as_deref()
            .or(item.first_air_date.as_deref());
        Self {
            media_key: item.media_key.clone(),
            provider: item.provider,
            media_type: item.media_type,
            title: item.title.clone(),
            poster_path: item.poster_path.clone(),
            poster_file: None,
            year: date
                .map(|d| d.chars().take(4).collect::<String>())
                .filter(|y| y.len() == 4),
        }
    }
}

// The user's own length data; every field is optional and only the planner needs it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Length {
    pub runtime_minutes: Option<u32>,
    pub episodes: Option<u32>,
    pub episode_minutes: Option<u32>,
    pub chapters: Option<u32>,
    pub chapter_minutes: Option<u32>,
    pub pages: Option<u32>,
    pub hours: Option<u32>,
}

// The user's own data for one entry; units are per media type (undecided).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct UserData {
    pub status: Status,
    pub progress: u32,
    pub rating: Option<u8>,
    pub review: Option<String>,
    pub length: Length,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub key: String,
    pub snapshot: MediaSnapshot,
    #[serde(default)]
    pub user: UserData,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

// One activity-log line; ids and dates are stamped by the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub kind: String,
    pub media_key: String,
    pub at_utc: String,
    pub local_date: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::api::types::Id;
    use serde_json::{json, Value};

    #[test]
    fn an_old_snapshot_without_poster_file_still_loads() {
        let json = r#"{"media_key":"tmdb:tv:7","provider":"tmdb","media_type":"tv","title":"Arcane","poster_path":"https://image.tmdb.org/t/p/w500/a.jpg","year":"2021"}"#;
        let s: MediaSnapshot = serde_json::from_str(json).unwrap();
        assert_eq!(s.poster_file, None);
    }

    const CONTRACT: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../src/lib/types/library.contract.fixture.json"
    );

    fn item() -> MediaItem {
        MediaItem {
            poster_path: Some("https://example.com/p.jpg".into()),
            first_air_date: Some("2021-10-02".into()),
            ..MediaItem::new(Id::Num(7), "Arcane".into(), MediaType::Tv, ProviderId::Tmdb)
        }
    }

    pub(crate) fn event(id: &str) -> Event {
        Event {
            id: id.into(),
            kind: "status_changed".into(),
            media_key: "tmdb:tv:7".into(),
            at_utc: "2026-09-24T02:00:00Z".into(),
            local_date: "2026-09-23".into(),
            payload: json!({ "from": "planning", "to": "in_progress" }),
        }
    }

    fn entry() -> LibraryEntry {
        LibraryEntry {
            key: "tmdb:tv:7".into(),
            snapshot: MediaSnapshot::from_item(&item()),
            user: UserData {
                status: Status::InProgress,
                progress: 3,
                rating: Some(9),
                review: Some("Great".into()),
                length: Length {
                    episodes: Some(9),
                    episode_minutes: Some(40),
                    ..Length::default()
                },
            },
            created_at: "2026-09-24T02:00:00Z".into(),
            updated_at: "2026-09-24T02:00:00Z".into(),
        }
    }

    #[test]
    fn snapshot_copies_the_card_fields_and_the_year() {
        let s = MediaSnapshot::from_item(&item());
        assert_eq!(s.media_key, "tmdb:tv:7");
        assert_eq!(s.provider, ProviderId::Tmdb);
        assert_eq!(s.media_type, MediaType::Tv);
        assert_eq!(s.title, "Arcane");
        assert_eq!(s.poster_path.as_deref(), Some("https://example.com/p.jpg"));
        assert_eq!(s.year.as_deref(), Some("2021"));
    }

    #[test]
    fn snapshot_has_no_year_without_a_date() {
        let bare = MediaItem::new(Id::Num(1), "X".into(), MediaType::Game, ProviderId::Rawg);
        assert_eq!(MediaSnapshot::from_item(&bare).year, None);
    }

    #[test]
    fn statuses_serialize_as_snake_case() {
        assert_eq!(
            serde_json::to_value(Status::InProgress).unwrap(),
            json!("in_progress")
        );
    }

    #[test]
    fn an_entry_saved_by_an_older_app_still_reads() {
        let old = json!({
            "key": "tmdb:tv:7",
            "snapshot": { "media_key": "tmdb:tv:7", "provider": "tmdb", "media_type": "tv" },
            "future_field": true
        });
        let e: LibraryEntry = serde_json::from_value(old).unwrap();
        assert_eq!(e.user, UserData::default());
        assert_eq!(e.user.status, Status::Planning);
        assert_eq!(e.snapshot.title, "");
    }

    #[test]
    fn length_defaults_to_all_unknown() {
        let user = UserData::default();
        assert_eq!(user.length, Length::default());
        assert!(user.length.pages.is_none());
        assert!(user.length.hours.is_none());
    }

    #[test]
    fn old_files_without_length_still_load() {
        let json = r#"{"status":"completed","progress":3,"rating":8,"review":null}"#;
        let user: UserData = serde_json::from_str(json).expect("legacy UserData must load");
        assert_eq!(user.progress, 3);
        assert_eq!(user.length, Length::default());
    }

    #[test]
    fn length_round_trips_through_json() {
        let user = UserData {
            length: Length {
                pages: Some(350),
                ..Length::default()
            },
            ..UserData::default()
        };
        let text = serde_json::to_string(&user).unwrap();
        let back: UserData = serde_json::from_str(&text).unwrap();
        assert_eq!(back.length.pages, Some(350));
    }

    fn contract() -> Value {
        json!({ "entry": entry(), "event": event("e1") })
    }

    #[test]
    fn library_contract_fixture_matches_the_rust_types() {
        let expected = contract();
        if std::env::var_os("UPDATE_CONTRACT").is_some() {
            let text = serde_json::to_string_pretty(&expected).unwrap() + "\n";
            std::fs::write(CONTRACT, text).unwrap();
        }
        let committed: Value = std::fs::read_to_string(CONTRACT)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .expect("missing library contract fixture; run with UPDATE_CONTRACT=1");
        assert_eq!(
            committed, expected,
            "Rust types changed; rerun with UPDATE_CONTRACT=1 and update library.ts"
        );
    }
}
