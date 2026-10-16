use super::types::MediaSnapshot;
use crate::api::types::{MediaType, ProviderId};
use serde::Deserialize;

const TITLE_MAX: usize = 200;
const CREATOR_MAX: usize = 200;
const OVERVIEW_MAX: usize = 2000;
const TAG_MAX: usize = 40;
const TAGS_MAX: usize = 10;

// What the add/edit form sends; everything but type and title may be blank.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ManualDraft {
    pub media_type: MediaType,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub year: Option<String>,
    #[serde(default)]
    pub creator: Option<String>,
    #[serde(default)]
    pub overview: Option<String>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(default)]
    pub platforms: Vec<String>,
}

pub fn manual_key(media_type: MediaType, id: &str) -> String {
    format!("manual:{media_type}:{id}")
}

// Checks and tidies a draft into the snapshot stored under `key`.
pub fn snapshot(draft: &ManualDraft, key: &str) -> Result<MediaSnapshot, String> {
    let title = required(&draft.title)?;
    within("title", &title, TITLE_MAX)?;
    let creator = optional(draft.creator.as_deref());
    if let Some(c) = &creator {
        within("creator", c, CREATOR_MAX)?;
    }
    let overview = optional(draft.overview.as_deref());
    if let Some(o) = &overview {
        within("description", o, OVERVIEW_MAX)?;
    }
    let year = optional(draft.year.as_deref());
    if let Some(y) = &year {
        check_year(y)?;
    }
    let platforms = match draft.media_type {
        MediaType::Game => tags("platform", &draft.platforms)?,
        _ => Vec::new(),
    };
    Ok(MediaSnapshot {
        media_key: key.to_string(),
        provider: ProviderId::Manual,
        media_type: draft.media_type,
        title,
        poster_path: None,
        poster_file: None,
        year,
        creator,
        overview,
        genres: tags("genre", &draft.genres)?,
        platforms,
    })
}

fn required(s: &str) -> Result<String, String> {
    optional(Some(s)).ok_or_else(|| "a title is required".to_string())
}

fn optional(s: Option<&str>) -> Option<String> {
    s.map(str::trim).filter(|s| !s.is_empty()).map(String::from)
}

fn within(field: &str, s: &str, max: usize) -> Result<(), String> {
    match s.chars().count() {
        n if n > max => Err(format!("the {field} is longer than {max} characters")),
        _ => Ok(()),
    }
}

fn check_year(y: &str) -> Result<(), String> {
    match y.parse::<u16>() {
        Ok(n) if y.len() == 4 && (1000..=2999).contains(&n) => Ok(()),
        _ => Err(format!("{y} is not a year")),
    }
}

// Trimmed, blanks dropped, first spelling kept on case-insensitive repeats.
fn tags(field: &str, raw: &[String]) -> Result<Vec<String>, String> {
    let mut out: Vec<String> = Vec::new();
    for tag in raw.iter().filter_map(|t| optional(Some(t))) {
        within(field, &tag, TAG_MAX)?;
        if !out.iter().any(|t| t.to_lowercase() == tag.to_lowercase()) {
            out.push(tag);
        }
    }
    match out.len() {
        n if n > TAGS_MAX => Err(format!("more than {TAGS_MAX} {field}s")),
        _ => Ok(out),
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::api::types::MediaKey;

    const KEY: &str = "manual:book:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";

    pub(crate) fn draft(media_type: MediaType, title: &str) -> ManualDraft {
        ManualDraft {
            media_type,
            title: title.into(),
            year: None,
            creator: None,
            overview: None,
            genres: Vec::new(),
            platforms: Vec::new(),
        }
    }

    fn err(d: ManualDraft) -> String {
        snapshot(&d, KEY).expect_err("draft should be refused")
    }

    #[test]
    fn the_key_parses_back_as_a_manual_key() {
        let key = manual_key(MediaType::Book, "0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69");
        assert_eq!(key, KEY);
        let parsed = MediaKey::parse(&key).unwrap();
        assert_eq!(parsed.provider, ProviderId::Manual);
        assert_eq!(parsed.media_type, MediaType::Book);
    }

    #[test]
    fn a_title_only_draft_becomes_a_bare_manual_snapshot() {
        let s = snapshot(&draft(MediaType::Book, "  Dune  "), KEY).unwrap();
        assert_eq!(s.media_key, KEY);
        assert_eq!(s.provider, ProviderId::Manual);
        assert_eq!(s.media_type, MediaType::Book);
        assert_eq!(s.title, "Dune");
        assert_eq!((s.poster_path, s.poster_file, s.year), (None, None, None));
        assert_eq!((s.creator, s.overview), (None, None));
        assert!(s.genres.is_empty() && s.platforms.is_empty());
    }

    #[test]
    fn every_optional_field_is_trimmed_and_blanks_become_none() {
        let d = ManualDraft {
            year: Some(" 1965 ".into()),
            creator: Some(" Frank Herbert ".into()),
            overview: Some("   ".into()),
            ..draft(MediaType::Book, "Dune")
        };
        let s = snapshot(&d, KEY).unwrap();
        assert_eq!(s.year.as_deref(), Some("1965"));
        assert_eq!(s.creator.as_deref(), Some("Frank Herbert"));
        assert_eq!(s.overview, None);
    }

    #[test]
    fn a_blank_title_is_refused() {
        assert!(err(draft(MediaType::Movie, "   ")).contains("title is required"));
    }

    #[test]
    fn overlong_text_is_refused() {
        let long = |n| "x".repeat(n);
        assert!(snapshot(&draft(MediaType::Movie, &long(200)), KEY).is_ok());
        assert!(err(draft(MediaType::Movie, &long(201))).contains("title"));
        let creator = ManualDraft {
            creator: Some(long(201)),
            ..draft(MediaType::Movie, "X")
        };
        assert!(err(creator).contains("creator"));
        let overview = ManualDraft {
            overview: Some(long(2001)),
            ..draft(MediaType::Movie, "X")
        };
        assert!(err(overview).contains("description"));
    }

    #[test]
    fn lengths_count_characters_not_bytes() {
        let wide = ManualDraft {
            creator: Some("★".repeat(200)),
            ..draft(MediaType::Book, "X")
        };
        assert!(snapshot(&wide, KEY).is_ok());
    }

    #[test]
    fn a_year_must_be_four_digits_between_1000_and_2999() {
        for ok in ["1000", "1965", "2999"] {
            let d = ManualDraft {
                year: Some(ok.into()),
                ..draft(MediaType::Movie, "X")
            };
            assert!(snapshot(&d, KEY).is_ok(), "{ok}");
        }
        for bad in ["999", "0999", "3000", "65", "19a5", "-965", "+965"] {
            let d = ManualDraft {
                year: Some(bad.into()),
                ..draft(MediaType::Movie, "X")
            };
            assert!(err(d).contains("not a year"), "{bad}");
        }
    }

    #[test]
    fn genres_are_trimmed_and_deduplicated_ignoring_case() {
        let d = ManualDraft {
            genres: vec![
                " Sci-fi ".into(),
                "".into(),
                "Drama".into(),
                "sci-FI".into(),
            ],
            ..draft(MediaType::Movie, "X")
        };
        assert_eq!(snapshot(&d, KEY).unwrap().genres, ["Sci-fi", "Drama"]);
    }

    #[test]
    fn too_many_or_too_long_tags_are_refused() {
        let many = ManualDraft {
            genres: (0..11).map(|i| format!("g{i}")).collect(),
            ..draft(MediaType::Movie, "X")
        };
        assert!(err(many).contains("more than 10 genres"));
        let long = ManualDraft {
            genres: vec!["x".repeat(41)],
            ..draft(MediaType::Movie, "X")
        };
        assert!(err(long).contains("genre"));
    }

    #[test]
    fn platforms_are_kept_for_games_and_dropped_for_the_rest() {
        let with = |t| ManualDraft {
            platforms: vec!["PC".into(), "pc".into(), "Switch".into()],
            ..draft(t, "X")
        };
        assert_eq!(
            snapshot(&with(MediaType::Game), KEY).unwrap().platforms,
            ["PC", "Switch"]
        );
        assert!(snapshot(&with(MediaType::Book), KEY)
            .unwrap()
            .platforms
            .is_empty());
    }

    #[test]
    fn a_draft_without_a_type_is_refused_by_serde() {
        assert!(serde_json::from_str::<ManualDraft>(r#"{"title":"Mine"}"#).is_err());
    }

    #[test]
    fn a_draft_reads_with_only_type_and_title() {
        let d: ManualDraft =
            serde_json::from_str(r#"{"media_type":"anime","title":"Mine"}"#).unwrap();
        assert_eq!(d, draft(MediaType::Anime, "Mine"));
    }
}
