use super::catalog::Provider;
use super::http::{client as http, fetch};
use super::types::{
    CastMember, Genre, GenreOption, Id, MediaDetail, MediaItem, MediaType, Page, ProviderId,
    VideoClip,
};
use serde::Deserialize;

const PROVIDER: ProviderId = ProviderId::Tmdb;

const BASE: &str = "https://api.themoviedb.org/3";
const IMG: &str = "https://image.tmdb.org/t/p";
const LANG: &str = "en-US";
const MAX_CAST: usize = 20;

// Runtime env wins; falls back to the key baked in from `.env` by build.rs.
fn api_key() -> String {
    std::env::var("TMDB_API_KEY").unwrap_or_else(|_| env!("TMDB_API_KEY").to_string())
}

fn img(size: &str, path: Option<&str>) -> Option<String> {
    path.map(|p| format!("{IMG}/{size}{p}"))
}

#[derive(Deserialize)]
struct RawPage {
    #[serde(default)]
    results: Vec<RawItem>,
    page: Option<u32>,
    total_pages: Option<u32>,
    total_results: Option<u32>,
}

#[derive(Deserialize)]
struct RawItem {
    id: u64,
    title: Option<String>,
    original_title: Option<String>,
    name: Option<String>,
    original_name: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    vote_average: Option<f64>,
    vote_count: Option<u64>,
    release_date: Option<String>,
    first_air_date: Option<String>,
    genre_ids: Option<Vec<u64>>,
}

#[derive(Deserialize)]
struct RawGenres {
    #[serde(default)]
    genres: Vec<RawGenre>,
}

#[derive(Deserialize)]
struct RawGenre {
    id: u64,
    name: String,
}

#[derive(Deserialize)]
struct RawDetail {
    id: u64,
    title: Option<String>,
    name: Option<String>,
    tagline: Option<String>,
    overview: Option<String>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    vote_average: Option<f64>,
    vote_count: Option<u64>,
    release_date: Option<String>,
    first_air_date: Option<String>,
    runtime: Option<u32>,
    #[serde(default)]
    episode_run_time: Vec<u32>,
    #[serde(default)]
    genres: Vec<RawGenre>,
    credits: Option<RawCredits>,
    videos: Option<RawVideos>,
    number_of_episodes: Option<u32>,
    status: Option<String>,
    #[serde(default)]
    production_companies: Vec<RawCompany>,
}

#[derive(Deserialize)]
struct RawCredits {
    #[serde(default)]
    cast: Vec<RawCast>,
}

#[derive(Deserialize)]
struct RawCast {
    id: u64,
    name: Option<String>,
    character: Option<String>,
    profile_path: Option<String>,
}

#[derive(Deserialize)]
struct RawVideos {
    #[serde(default)]
    results: Vec<RawVideo>,
}

#[derive(Deserialize)]
struct RawVideo {
    key: String,
    site: String,
    #[serde(rename = "type")]
    kind: String,
    name: String,
}

#[derive(Deserialize)]
struct RawCompany {
    name: Option<String>,
}

fn map_item(raw: RawItem, media_type: MediaType) -> MediaItem {
    let is_tv = media_type == MediaType::Tv;
    let title = if is_tv {
        raw.name.or(raw.original_name)
    } else {
        raw.title.or(raw.original_title)
    };
    MediaItem {
        overview: raw.overview.unwrap_or_default(),
        poster_path: img("w342", raw.poster_path.as_deref()),
        backdrop_path: img("w780", raw.backdrop_path.as_deref()),
        vote_average: raw.vote_average.unwrap_or(0.0),
        vote_count: raw.vote_count.unwrap_or(0),
        release_date: if is_tv { None } else { raw.release_date },
        first_air_date: if is_tv { raw.first_air_date } else { None },
        genre_ids: Some(raw.genre_ids.unwrap_or_default()),
        ..MediaItem::new(
            Id::Num(raw.id),
            title.unwrap_or_else(|| "Untitled".into()),
            media_type,
            PROVIDER,
        )
    }
}

fn map_page(raw: RawPage, media_type: MediaType) -> Page<MediaItem> {
    Page {
        results: raw
            .results
            .into_iter()
            .map(|r| map_item(r, media_type))
            .collect(),
        page: raw.page.unwrap_or(1),
        total_pages: raw.total_pages.unwrap_or(1),
        total_results: raw.total_results.unwrap_or(0),
    }
}

fn map_genres(raw: RawGenres) -> Vec<GenreOption> {
    raw.genres
        .into_iter()
        .map(|g| GenreOption {
            id: Id::Num(g.id),
            name: g.name,
        })
        .collect()
}

fn map_detail(raw: RawDetail, media_type: MediaType) -> MediaDetail {
    let cast = raw
        .credits
        .map(|c| c.cast)
        .unwrap_or_default()
        .into_iter()
        .take(MAX_CAST)
        .map(|c| CastMember {
            id: c.id,
            name: c.name.unwrap_or_default(),
            character: c.character.unwrap_or_default(),
            profile_path: img("w185", c.profile_path.as_deref()),
        })
        .collect();
    let videos = raw
        .videos
        .map(|v| v.results)
        .unwrap_or_default()
        .into_iter()
        .filter(|v| v.site == "YouTube")
        .map(|v| VideoClip {
            key: v.key,
            site: v.site,
            kind: v.kind,
            name: v.name,
        })
        .collect();
    MediaDetail {
        tagline: raw.tagline.unwrap_or_default(),
        overview: raw.overview.unwrap_or_default(),
        poster_path: img("w500", raw.poster_path.as_deref()),
        backdrop_path: img("w1280", raw.backdrop_path.as_deref()),
        vote_average: raw.vote_average.unwrap_or(0.0),
        vote_count: raw.vote_count.unwrap_or(0),
        release_date: raw.release_date.or(raw.first_air_date).unwrap_or_default(),
        runtime: raw.runtime.or(raw.episode_run_time.first().copied()),
        genres: raw
            .genres
            .into_iter()
            .map(|g| Genre {
                id: Id::Num(g.id),
                name: g.name,
            })
            .collect(),
        cast,
        videos,
        episodes: raw.number_of_episodes,
        status: raw.status,
        studios: Some(
            raw.production_companies
                .into_iter()
                .filter_map(|c| c.name.filter(|n| !n.is_empty()))
                .collect(),
        ),
        ..MediaDetail::new(
            Id::Num(raw.id),
            raw.title.or(raw.name).unwrap_or_else(|| "Untitled".into()),
            media_type,
            PROVIDER,
        )
    }
}

// Search ignores the genre; a numeric genre switches /popular to /discover.
fn page_request(
    kind: &str,
    query: &str,
    page: u32,
    genre: Option<u64>,
) -> (String, Vec<(&'static str, String)>) {
    let mut params = vec![("language", LANG.to_string()), ("page", page.to_string())];
    if !query.trim().is_empty() {
        params.push(("query", query.to_string()));
        params.push(("include_adult", "false".into()));
        return (format!("{BASE}/search/{kind}"), params);
    }
    match genre {
        Some(g) => {
            params.push(("sort_by", "popularity.desc".into()));
            params.push(("include_adult", "false".into()));
            params.push(("with_genres", g.to_string()));
            (format!("{BASE}/discover/{kind}"), params)
        }
        None => (format!("{BASE}/{kind}/popular"), params),
    }
}

// TMDB serves movies and TV with the same shapes; the media type picks the path.
pub(crate) struct Tmdb(pub MediaType);

impl Tmdb {
    fn kind(&self) -> &'static str {
        if self.0 == MediaType::Tv {
            "tv"
        } else {
            "movie"
        }
    }
}

impl Provider for Tmdb {
    async fn genres(&self) -> Result<Vec<GenreOption>, String> {
        let req = http()
            .get(format!("{BASE}/genre/{}/list", self.kind()))
            .query(&[("api_key", api_key().as_str()), ("language", LANG)]);
        Ok(map_genres(fetch("tmdb", "genres", req).await?))
    }

    async fn page(
        &self,
        query: &str,
        page: u32,
        genre: Option<Id>,
    ) -> Result<Page<MediaItem>, String> {
        let (url, params) = page_request(self.kind(), query, page, genre.and_then(|g| g.as_num()));
        let op = if params.iter().any(|(k, _)| *k == "query") {
            "search"
        } else {
            "discover"
        };
        let req = http()
            .get(url)
            .query(&[("api_key", api_key())])
            .query(&params);
        Ok(map_page(fetch("tmdb", op, req).await?, self.0))
    }

    async fn detail(&self, id: Id) -> Result<MediaDetail, String> {
        let id = id.as_num().ok_or("Invalid ID.")?;
        let req = http().get(format!("{BASE}/{}/{id}", self.kind())).query(&[
            ("api_key", api_key().as_str()),
            ("language", LANG),
            ("append_to_response", "credits,videos"),
        ]);
        Ok(map_detail(fetch("tmdb", "details", req).await?, self.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::http::decode;

    fn sample<T: serde::de::DeserializeOwned>(name: &str) -> T {
        let path = format!("{}/tests/fixtures/{name}.json", env!("CARGO_MANIFEST_DIR"));
        let text = std::fs::read_to_string(path).unwrap();
        decode("test", serde_json::from_str(&text).unwrap()).unwrap()
    }

    #[test]
    fn requests_english_content() {
        assert_eq!(LANG, "en-US");
    }

    #[test]
    fn movie_page_maps_titles_images_and_totals() {
        let page = map_page(sample("tmdb_movie_page"), MediaType::Movie);
        let first = &page.results[0];
        assert_eq!(first.media_key, format!("tmdb:movie:{}", first.id));
        assert_eq!(page.results.len(), 3);
        assert!(page.total_pages > 1);
        assert_eq!(first.media_type, MediaType::Movie);
        assert!(first
            .poster_path
            .as_deref()
            .unwrap()
            .starts_with(&format!("{IMG}/w342/")));
        assert!(first.release_date.is_some() && first.first_air_date.is_none());
        assert!(!first.title.is_empty());
    }

    #[test]
    fn tv_page_uses_name_and_first_air_date() {
        let page = map_page(sample("tmdb_tv_page"), MediaType::Tv);
        let first = &page.results[0];
        assert_eq!(first.media_key, format!("tmdb:tv:{}", first.id));
        assert_eq!(first.media_type, MediaType::Tv);
        assert!(first.first_air_date.is_some() && first.release_date.is_none());
        assert_ne!(first.title, "Untitled");
    }

    #[test]
    fn missing_fields_fall_back_like_the_ui_expects() {
        let raw: RawItem = decode("test", serde_json::json!({"id": 7})).unwrap();
        let item = map_item(raw, MediaType::Movie);
        assert_eq!(item.title, "Untitled");
        assert_eq!(item.poster_path, None);
        assert_eq!(item.genre_ids, Some(vec![]));
    }

    #[test]
    fn movie_detail_caps_cast_and_keeps_only_youtube_videos() {
        let d = map_detail(sample("tmdb_movie_detail"), MediaType::Movie);
        assert_eq!(d.media_key, format!("tmdb:movie:{}", d.id));
        assert_eq!(d.title, "Fight Club");
        assert_eq!(d.cast.len(), MAX_CAST);
        assert!(d.videos.iter().all(|v| v.site == "YouTube"));
        assert!(d.poster_path.unwrap().contains("/w500/"));
        assert!(d.backdrop_path.unwrap().contains("/w1280/"));
        assert_eq!(d.runtime, Some(139));
        assert!(!d.studios.unwrap().is_empty());
    }

    #[test]
    fn tv_detail_reads_name_air_date_and_episodes() {
        let d = map_detail(sample("tmdb_tv_detail"), MediaType::Tv);
        assert_eq!(d.title, "Game of Thrones");
        assert_eq!(d.release_date, "2011-04-17");
        assert_eq!(d.episodes, Some(73));
    }

    #[test]
    fn genres_map_to_numeric_ids() {
        let g = map_genres(sample("tmdb_genres"));
        assert_eq!(g[0].id, Id::Num(28));
        assert_eq!(g[0].name, "Action");
    }

    #[test]
    fn page_request_picks_search_discover_or_popular() {
        let (url, p) = page_request("movie", "heat", 2, Some(28));
        assert!(url.ends_with("/search/movie"));
        assert!(p.contains(&("query", "heat".into())));
        assert!(!p.iter().any(|(k, _)| *k == "with_genres"));

        let (url, p) = page_request("tv", "  ", 1, Some(18));
        assert!(url.ends_with("/discover/tv"));
        assert!(p.contains(&("with_genres", "18".into())));

        let (url, _) = page_request("movie", "", 1, None);
        assert!(url.ends_with("/movie/popular"));
    }
}
