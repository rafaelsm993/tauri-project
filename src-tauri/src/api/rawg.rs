use super::catalog::Provider;
use super::http::{client as http, fetch};
use super::types::{
    round1, strip_html, Genre, GenreOption, Id, MediaDetail, MediaItem, MediaType, Page, ProviderId,
};
use serde::Deserialize;

const PROVIDER: ProviderId = ProviderId::Rawg;

const BASE: &str = "https://api.rawg.io/api";

fn api_key() -> String {
    std::env::var("RAWG_API_KEY").unwrap_or_else(|_| env!("RAWG_API_KEY").to_string())
}

const PAGE_SIZE: u32 = 20;
/// RAWG refuses deep paging; never advertise more than this.
const MAX_PAGES: u32 = 500;

/// Pages to advertise to the UI. Never less than the page the UI is on.
fn total_pages(total: u32, page: u32) -> u32 {
    total.div_ceil(PAGE_SIZE).min(MAX_PAGES).max(page)
}

#[derive(Deserialize)]
struct RawPage {
    count: Option<u32>,
    #[serde(default)]
    results: Vec<RawGame>,
}

#[derive(Deserialize)]
struct RawGame {
    id: u64,
    name: Option<String>,
    background_image: Option<String>,
    rating: Option<f64>,
    ratings_count: Option<u64>,
    released: Option<String>,
}

#[derive(Deserialize)]
struct RawGenres {
    #[serde(default)]
    results: Vec<RawGenre>,
}

#[derive(Deserialize)]
struct RawGenre {
    slug: String,
    name: String,
}

#[derive(Deserialize)]
struct RawDetail {
    id: u64,
    name: Option<String>,
    description: Option<String>,
    description_raw: Option<String>,
    background_image: Option<String>,
    background_image_additional: Option<String>,
    rating: Option<f64>,
    ratings_count: Option<u64>,
    released: Option<String>,
    playtime: Option<u32>,
    #[serde(default)]
    tba: bool,
    #[serde(default)]
    genres: Vec<RawDetailGenre>,
    #[serde(default)]
    developers: Vec<RawNamed>,
    #[serde(default)]
    publishers: Vec<RawNamed>,
    #[serde(default)]
    platforms: Vec<RawPlatformEntry>,
}

#[derive(Deserialize)]
struct RawDetailGenre {
    id: u64,
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawNamed {
    name: String,
}

#[derive(Deserialize)]
struct RawPlatformEntry {
    platform: Option<RawPlatform>,
}

#[derive(Deserialize)]
struct RawPlatform {
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawShots {
    #[serde(default)]
    results: Vec<RawShot>,
}

#[derive(Deserialize)]
struct RawShot {
    image: Option<String>,
}

// RAWG rates 0-5; the UI uses 0-10.
fn rating10(r: Option<f64>) -> f64 {
    r.filter(|v| *v != 0.0).map_or(0.0, |v| round1(v * 2.0))
}

fn year(date: Option<&str>) -> Option<String> {
    date.map(|d| d.chars().take(4).collect::<String>())
        .filter(|y| !y.is_empty())
}

fn map_item(raw: RawGame) -> MediaItem {
    MediaItem {
        poster_path: raw.background_image.clone(),
        backdrop_path: raw.background_image,
        vote_average: rating10(raw.rating),
        vote_count: raw.ratings_count.unwrap_or(0),
        release_date: year(raw.released.as_deref()),
        ..MediaItem::new(
            Id::Num(raw.id),
            raw.name.unwrap_or_else(|| "Untitled".into()),
            MediaType::Game,
            PROVIDER,
        )
    }
}

fn map_page(raw: RawPage, page: u32) -> Page<MediaItem> {
    let total = raw.count.unwrap_or(0);
    Page {
        results: raw.results.into_iter().map(map_item).collect(),
        page,
        total_pages: total_pages(total, page),
        total_results: total,
    }
}

fn map_genres(raw: RawGenres) -> Vec<GenreOption> {
    raw.results
        .into_iter()
        .map(|g| GenreOption {
            id: Id::Str(g.slug),
            name: g.name,
        })
        .collect()
}

fn names(list: &[RawNamed]) -> Vec<String> {
    list.iter().map(|n| n.name.clone()).collect()
}

fn map_detail(raw: RawDetail, shots: Option<RawShots>) -> MediaDetail {
    let developers = names(&raw.developers);
    let mut platforms: Vec<String> = Vec::new();
    for name in raw.platforms.into_iter().filter_map(|p| p.platform?.name) {
        if !name.is_empty() && !platforms.contains(&name) {
            platforms.push(name);
        }
    }
    let screenshots = shots
        .map(|s| s.results.into_iter().filter_map(|s| s.image).collect())
        .unwrap_or_default();
    let description = raw.description.or(raw.description_raw).unwrap_or_default();
    MediaDetail {
        tagline: developers.join(", "),
        overview: strip_html(&description),
        backdrop_path: raw
            .background_image_additional
            .or(raw.background_image.clone()),
        poster_path: raw.background_image,
        vote_average: rating10(raw.rating),
        vote_count: raw.ratings_count.unwrap_or(0),
        release_date: raw.released.unwrap_or_default(),
        runtime: raw.playtime.filter(|p| *p > 0).map(|p| p * 60),
        genres: raw
            .genres
            .into_iter()
            .map(|g| Genre {
                id: Id::Num(g.id),
                name: g.name.unwrap_or_default(),
            })
            .collect(),
        status: raw.tba.then(|| "Coming soon".to_string()),
        developer: Some(developers.join(", ")),
        publisher: Some(names(&raw.publishers).join(", ")),
        platforms: Some(platforms),
        screenshots: Some(screenshots),
        studios: Some(developers),
        ..MediaDetail::new(
            Id::Num(raw.id),
            raw.name.unwrap_or_else(|| "Untitled".into()),
            MediaType::Game,
            PROVIDER,
        )
    }
}

fn page_params(query: &str, page: u32, genre: Option<&str>) -> Vec<(&'static str, String)> {
    let mut params = vec![
        ("page", page.to_string()),
        ("page_size", PAGE_SIZE.to_string()),
    ];
    if query.trim().is_empty() {
        params.push(("ordering", "-added".into()));
    } else {
        params.push(("search", query.to_string()));
        params.push(("search_precise", "true".into()));
    }
    if let Some(g) = genre {
        params.push(("genres", g.to_string()));
    }
    params
}

pub(crate) struct Rawg;

impl Provider for Rawg {
    async fn genres(&self) -> Result<Vec<GenreOption>, String> {
        let req = http()
            .get(format!("{BASE}/genres"))
            .query(&[("key", api_key().as_str()), ("page_size", "40")]);
        Ok(map_genres(fetch("rawg", "genres", req).await?))
    }

    async fn page(
        &self,
        query: &str,
        page: u32,
        genre: Option<Id>,
    ) -> Result<Page<MediaItem>, String> {
        let params = page_params(query, page, genre.as_ref().and_then(Id::as_str));
        let op = if query.trim().is_empty() {
            "discover"
        } else {
            "search"
        };
        let req = http()
            .get(format!("{BASE}/games"))
            .query(&[("key", api_key())])
            .query(&params);
        Ok(map_page(fetch("rawg", op, req).await?, page))
    }

    // Metadata and screenshots live on two endpoints; fetched in parallel, screenshots optional.
    async fn detail(&self, id: Id) -> Result<MediaDetail, String> {
        let id = id.as_num().ok_or("Invalid ID.")?;
        let key = api_key();
        let detail_req = http()
            .get(format!("{BASE}/games/{id}"))
            .query(&[("key", key.as_str())]);
        let shots_req = http()
            .get(format!("{BASE}/games/{id}/screenshots"))
            .query(&[("key", key.as_str())]);
        let (detail, shots) = tokio::join!(
            fetch::<RawDetail>("rawg", "details", detail_req),
            fetch::<RawShots>("rawg", "screenshots", shots_req)
        );
        Ok(map_detail(detail?, shots.ok()))
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
    fn empty_result_still_reports_current_page() {
        assert_eq!(total_pages(0, 1), 1);
        assert_eq!(total_pages(0, 7), 7);
    }

    #[test]
    fn rounds_partial_pages_up() {
        assert_eq!(total_pages(20, 1), 1);
        assert_eq!(total_pages(21, 1), 2);
        assert_eq!(total_pages(41, 1), 3);
    }

    #[test]
    fn caps_deep_paging_at_rawg_limit() {
        assert_eq!(total_pages(1_000_000, 1), 500);
    }

    #[test]
    fn rating10_doubles_and_rounds() {
        assert_eq!(rating10(Some(4.47)), 8.9);
        assert_eq!(rating10(None), 0.0);
    }

    #[test]
    fn page_maps_games_with_year_and_capped_totals() {
        let page = map_page(sample("rawg_page"), 1);
        let first = &page.results[0];
        assert_eq!(first.media_key, format!("rawg:game:{}", first.id));
        assert_eq!(page.results.len(), 3);
        assert_eq!(page.total_pages, MAX_PAGES);
        assert_eq!(first.media_type, MediaType::Game);
        assert_eq!(first.release_date.as_ref().map(String::len), Some(4));
        assert_eq!(first.poster_path, first.backdrop_path);
        assert_eq!(first.overview, "");
    }

    #[test]
    fn genres_use_slugs_as_ids() {
        let g = map_genres(sample("rawg_genres"));
        assert_eq!(g[0].id, Id::Str("action".into()));
    }

    #[test]
    fn detail_merges_screenshots_and_dedupes_platforms() {
        let d = map_detail(sample("rawg_detail"), Some(sample("rawg_screenshots")));
        assert_eq!(d.media_key, format!("rawg:game:{}", d.id));
        assert_eq!(d.title, "Grand Theft Auto V");
        assert!(!d.overview.contains('<'));
        assert_eq!(d.screenshots.as_ref().unwrap().len(), 3);
        let p = d.platforms.unwrap();
        let mut unique = p.clone();
        unique.dedup();
        assert_eq!(p, unique);
        assert_eq!(d.tagline, d.developer.clone().unwrap());
        assert_eq!(d.runtime, Some(74 * 60));
        assert_eq!(d.status, None);
    }

    #[test]
    fn detail_without_screenshots_still_renders() {
        let d = map_detail(sample("rawg_detail"), None);
        assert_eq!(d.screenshots, Some(vec![]));
    }

    #[test]
    fn page_params_switch_between_search_and_discover() {
        let p = page_params("zelda", 2, Some("rpg"));
        assert!(p.contains(&("search", "zelda".into())));
        assert!(p.contains(&("genres", "rpg".into())));
        let p = page_params(" ", 1, None);
        assert!(p.contains(&("ordering", "-added".into())));
        assert!(!p.iter().any(|(k, _)| *k == "search"));
    }
}
