use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Movie,
    Tv,
    Anime,
    Manga,
    Book,
    Game,
}

impl MediaType {
    // Parses an untrusted URL segment.
    pub fn parse(s: &str) -> Result<Self, String> {
        match s {
            "movie" => Ok(Self::Movie),
            "tv" => Ok(Self::Tv),
            "anime" => Ok(Self::Anime),
            "manga" => Ok(Self::Manga),
            "book" => Ok(Self::Book),
            "game" => Ok(Self::Game),
            _ => Err("Invalid media type.".to_string()),
        }
    }
}

impl fmt::Display for MediaType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Movie => "movie",
            Self::Tv => "tv",
            Self::Anime => "anime",
            Self::Manga => "manga",
            Self::Book => "book",
            Self::Game => "game",
        })
    }
}

// Source of an item; `manual` is reserved for user-created entries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Tmdb,
    Anilist,
    Rawg,
    Itunes,
    Manual,
}

impl ProviderId {
    fn parse(s: &str) -> Option<Self> {
        match s {
            "tmdb" => Some(Self::Tmdb),
            "anilist" => Some(Self::Anilist),
            "rawg" => Some(Self::Rawg),
            "itunes" => Some(Self::Itunes),
            "manual" => Some(Self::Manual),
            _ => None,
        }
    }
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Tmdb => "tmdb",
            Self::Anilist => "anilist",
            Self::Rawg => "rawg",
            Self::Itunes => "itunes",
            Self::Manual => "manual",
        })
    }
}

// Library identity: `provider:media_type:id`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaKey {
    pub provider: ProviderId,
    pub media_type: MediaType,
    pub id: String,
}

impl MediaKey {
    pub fn parse(s: &str) -> Result<Self, String> {
        let invalid = || "Invalid media key.".to_string();
        let mut parts = s.splitn(3, ':');
        let provider = parts
            .next()
            .and_then(ProviderId::parse)
            .ok_or_else(invalid)?;
        let media_type = parts
            .next()
            .and_then(|t| MediaType::parse(t).ok())
            .ok_or_else(invalid)?;
        let id = parts.next().ok_or_else(invalid)?;
        if id.is_empty() || id.contains(':') {
            return Err(invalid());
        }
        Ok(Self {
            provider,
            media_type,
            id: id.to_string(),
        })
    }
}

impl fmt::Display for MediaKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}:{}", self.provider, self.media_type, self.id)
    }
}

pub fn media_key(provider: ProviderId, media_type: MediaType, id: &Id) -> String {
    format!("{provider}:{media_type}:{id}")
}

// Numeric for TMDB/AniList/RAWG, string for iTunes and genre slugs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Id {
    Num(u64),
    Str(String),
}

impl Id {
    pub fn as_num(&self) -> Option<u64> {
        match self {
            Self::Num(n) => Some(*n),
            Self::Str(_) => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::Num(_) => None,
            Self::Str(s) => Some(s),
        }
    }
}

impl fmt::Display for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Num(n) => write!(f, "{n}"),
            Self::Str(s) => f.write_str(s),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Page<T> {
    pub results: Vec<T>,
    pub page: u32,
    pub total_pages: u32,
    pub total_results: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GenreOption {
    pub id: Id,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MediaItem {
    pub id: Id,
    pub provider: ProviderId,
    pub media_key: String,
    pub title: String,
    pub overview: String,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub vote_average: f64,
    pub vote_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_air_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genre_ids: Option<Vec<u64>>,
    pub media_type: MediaType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub episodes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapters: Option<u32>,
}

impl MediaItem {
    pub fn new(id: Id, title: String, media_type: MediaType, provider: ProviderId) -> Self {
        Self {
            media_key: media_key(provider, media_type, &id),
            provider,
            id,
            title,
            overview: String::new(),
            poster_path: None,
            backdrop_path: None,
            vote_average: 0.0,
            vote_count: 0,
            release_date: None,
            first_air_date: None,
            genre_ids: None,
            media_type,
            author: None,
            episodes: None,
            chapters: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Genre {
    pub id: Id,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CastMember {
    pub id: u64,
    pub name: String,
    pub character: String,
    pub profile_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct VideoClip {
    pub key: String,
    pub site: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MediaDetail {
    pub id: Id,
    pub provider: ProviderId,
    pub media_key: String,
    pub media_type: MediaType,
    pub title: String,
    pub tagline: String,
    pub overview: String,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub vote_average: f64,
    pub vote_count: u64,
    pub release_date: String,
    pub runtime: Option<u32>,
    pub genres: Vec<Genre>,
    pub cast: Vec<CastMember>,
    pub videos: Vec<VideoClip>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub episodes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapters: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volumes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub studios: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subjects: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub developer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platforms: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshots: Option<Vec<String>>,
}

impl MediaDetail {
    pub fn new(id: Id, title: String, media_type: MediaType, provider: ProviderId) -> Self {
        Self {
            media_key: media_key(provider, media_type, &id),
            provider,
            id,
            media_type,
            title,
            tagline: String::new(),
            overview: String::new(),
            poster_path: None,
            backdrop_path: None,
            vote_average: 0.0,
            vote_count: 0,
            release_date: String::new(),
            runtime: None,
            genres: Vec::new(),
            cast: Vec::new(),
            videos: Vec::new(),
            author: None,
            episodes: None,
            chapters: None,
            volumes: None,
            status: None,
            studios: None,
            subjects: None,
            developer: None,
            publisher: None,
            platforms: None,
            screenshots: None,
        }
    }
}

// Removes tags, collapses whitespace and trims.
pub fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(start) = rest.find('<') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('>') {
            Some(end) if end > 0 => rest = &after[end + 1..],
            _ => {
                out.push('<');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

// Rounds to one decimal like JS `+x.toFixed(1)`.
pub fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    const CONTRACT: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../src/lib/types/contract.fixture.json"
    );

    fn full_item() -> MediaItem {
        MediaItem {
            id: Id::Num(1),
            provider: ProviderId::Tmdb,
            media_key: "tmdb:movie:1".into(),
            title: "Title".into(),
            overview: "Overview".into(),
            poster_path: Some("https://example.com/p.jpg".into()),
            backdrop_path: Some("https://example.com/b.jpg".into()),
            vote_average: 7.5,
            vote_count: 10,
            release_date: Some("2024-01-01".into()),
            first_air_date: Some("2024-01-01".into()),
            genre_ids: Some(vec![28]),
            media_type: MediaType::Movie,
            author: Some("Author".into()),
            episodes: Some(12),
            chapters: Some(100),
        }
    }

    fn full_detail() -> MediaDetail {
        MediaDetail {
            tagline: "Tagline".into(),
            overview: "Overview".into(),
            poster_path: Some("https://example.com/p.jpg".into()),
            backdrop_path: Some("https://example.com/b.jpg".into()),
            vote_average: 7.5,
            vote_count: 10,
            release_date: "2024-01-01".into(),
            runtime: Some(120),
            genres: vec![Genre {
                id: Id::Num(28),
                name: "Action".into(),
            }],
            cast: vec![CastMember {
                id: 1,
                name: "Name".into(),
                character: "Role".into(),
                profile_path: None,
            }],
            videos: vec![VideoClip {
                key: "abc".into(),
                site: "YouTube".into(),
                kind: "Trailer".into(),
                name: "Trailer".into(),
            }],
            author: Some("Author".into()),
            episodes: Some(12),
            chapters: Some(100),
            volumes: Some(10),
            status: Some("Released".into()),
            studios: Some(vec!["Studio".into()]),
            subjects: Some(vec!["Fiction".into()]),
            developer: Some("Developer".into()),
            publisher: Some("Publisher".into()),
            platforms: Some(vec!["PC".into()]),
            screenshots: Some(vec!["https://example.com/s.jpg".into()]),
            ..MediaDetail::new(
                Id::Str("x1".into()),
                "Title".into(),
                MediaType::Book,
                ProviderId::Itunes,
            )
        }
    }

    fn contract() -> Value {
        json!({
            "item": full_item(),
            "detail": full_detail(),
            "page": Page { results: vec![full_item()], page: 1, total_pages: 2, total_results: 30 },
            "genre": GenreOption { id: Id::Str("action".into()), name: "Action".into() },
        })
    }

    #[test]
    fn contract_fixture_matches_the_rust_types() {
        let expected = contract();
        if std::env::var_os("UPDATE_CONTRACT").is_some() {
            let text = serde_json::to_string_pretty(&expected).unwrap() + "\n";
            std::fs::write(CONTRACT, text).unwrap();
        }
        let committed: Value = std::fs::read_to_string(CONTRACT)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .expect("missing contract fixture; run with UPDATE_CONTRACT=1");
        assert_eq!(
            committed, expected,
            "Rust types changed; rerun with UPDATE_CONTRACT=1 and update media.ts"
        );
    }

    #[test]
    fn optional_fields_are_omitted_when_absent() {
        let v = serde_json::to_value(MediaItem::new(
            Id::Num(1),
            "T".into(),
            MediaType::Tv,
            ProviderId::Tmdb,
        ))
        .unwrap();
        assert!(v.get("episodes").is_none());
        assert_eq!(v["poster_path"], Value::Null);
        assert_eq!(v["media_type"], "tv");
    }

    #[test]
    fn ids_serialize_as_plain_numbers_or_strings() {
        assert_eq!(serde_json::to_value(Id::Num(7)).unwrap(), json!(7));
        assert_eq!(
            serde_json::to_value(Id::Str("a".into())).unwrap(),
            json!("a")
        );
        assert_eq!(
            serde_json::from_value::<Id>(json!(28)).unwrap(),
            Id::Num(28)
        );
        assert_eq!(
            serde_json::from_value::<Id>(json!("rpg")).unwrap(),
            Id::Str("rpg".into())
        );
    }

    #[test]
    fn media_type_parse_rejects_unknown_values() {
        assert_eq!(MediaType::parse("book"), Ok(MediaType::Book));
        assert_eq!(
            MediaType::parse("podcast"),
            Err("Invalid media type.".into())
        );
    }

    #[test]
    fn media_key_formats_provider_type_and_id() {
        assert_eq!(
            media_key(ProviderId::Tmdb, MediaType::Movie, &Id::Num(550)),
            "tmdb:movie:550"
        );
        assert_eq!(
            media_key(ProviderId::Itunes, MediaType::Book, &Id::Str("123".into())),
            "itunes:book:123"
        );
    }

    #[test]
    fn media_key_round_trips_for_every_provider() {
        for provider in [
            ProviderId::Tmdb,
            ProviderId::Anilist,
            ProviderId::Rawg,
            ProviderId::Itunes,
            ProviderId::Manual,
        ] {
            let key = media_key(provider, MediaType::Game, &Id::Num(7));
            let parsed = MediaKey::parse(&key).unwrap();
            assert_eq!(parsed.provider, provider);
            assert_eq!(parsed.media_type, MediaType::Game);
            assert_eq!(parsed.id, "7");
            assert_eq!(parsed.to_string(), key);
        }
    }

    #[test]
    fn media_key_parse_accepts_manual_uuid() {
        let key = MediaKey::parse("manual:book:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69").unwrap();
        assert_eq!(key.provider, ProviderId::Manual);
        assert_eq!(key.id, "0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69");
    }

    #[test]
    fn media_key_parse_rejects_malformed_keys() {
        for bad in [
            "",
            "tmdb:movie",
            "tmdb:movie:",
            "tmdb:movie:1:2",
            "imdb:movie:1",
            "tmdb:podcast:1",
        ] {
            assert_eq!(
                MediaKey::parse(bad),
                Err("Invalid media key.".into()),
                "{bad}"
            );
        }
    }

    #[test]
    fn items_carry_provider_and_media_key() {
        let v = serde_json::to_value(MediaItem::new(
            Id::Num(21),
            "T".into(),
            MediaType::Anime,
            ProviderId::Anilist,
        ))
        .unwrap();
        assert_eq!(v["provider"], "anilist");
        assert_eq!(v["media_key"], "anilist:anime:21");
        let d = MediaDetail::new(
            Id::Str("9".into()),
            "T".into(),
            MediaType::Book,
            ProviderId::Itunes,
        );
        assert_eq!(d.media_key, "itunes:book:9");
    }

    #[test]
    fn strip_html_removes_tags_and_collapses_whitespace() {
        assert_eq!(
            strip_html("<p>Hello <b>big</b>\n\n world</p> "),
            "Hello big world"
        );
        assert_eq!(strip_html("a <> b"), "a <> b");
        assert_eq!(strip_html(""), "");
    }

    #[test]
    fn round1_matches_to_fixed() {
        assert_eq!(round1(4.46 * 2.0), 8.9);
        assert_eq!(round1(8.0), 8.0);
    }
}
