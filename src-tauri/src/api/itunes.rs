use super::catalog::Provider;
use super::http::{client as http, fetch};
use super::types::{
    strip_html, Genre, GenreOption, Id, MediaDetail, MediaItem, MediaType, Page, ProviderId,
};
use serde::Deserialize;

const PROVIDER: ProviderId = ProviderId::Itunes;

const BASE: &str = "https://itunes.apple.com";
const PAGE_SIZE: u32 = 20;
const COUNTRY: &str = "us";

// iTunes has no genre endpoint; the slug is the search keyword.
const BOOK_GENRES: [(&str, &str); 20] = [
    ("romance", "Romance"),
    ("fantasy", "Fantasy"),
    ("science fiction", "Science Fiction"),
    ("mystery", "Mystery"),
    ("thriller", "Thriller"),
    ("horror", "Horror"),
    ("adventure", "Adventure"),
    ("drama", "Drama"),
    ("biography", "Biography"),
    ("history", "History"),
    ("self-help", "Self-Help"),
    ("business", "Business"),
    ("philosophy", "Philosophy"),
    ("religion", "Religion"),
    ("cooking", "Cooking"),
    ("children", "Children"),
    ("young adult", "Young Adult"),
    ("comics", "Comics"),
    ("poetry", "Poetry"),
    ("technology", "Technology"),
];

// Folds the genre keyword into the term; Apple ignores `genreId` for ebooks.
fn search_term(query: &str, genre: Option<&str>) -> String {
    let trimmed = query.trim();
    let has_query = !trimmed.is_empty() && trimmed != "popular";
    let genre_kw = genre.map(str::trim).filter(|s| !s.is_empty());
    match (has_query, genre_kw) {
        (true, Some(g)) => format!("{trimmed} {g}"),
        (true, None) => trimmed.to_string(),
        (false, Some(g)) => g.to_string(),
        (false, None) => "fiction".to_string(),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawSearch {
    result_count: Option<u32>,
    #[serde(default)]
    results: Vec<RawBook>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawBook {
    track_id: u64,
    track_name: Option<String>,
    track_censored_name: Option<String>,
    artist_name: Option<String>,
    description: Option<String>,
    artwork_url100: Option<String>,
    artwork_url60: Option<String>,
    average_user_rating: Option<f64>,
    user_rating_count: Option<u64>,
    release_date: Option<String>,
    #[serde(default)]
    genres: Vec<String>,
}

// Rewrites Apple's `/100x100bb.jpg` artwork suffix to a larger square.
pub(crate) fn upscale_cover(url: Option<&str>, size: u32) -> Option<String> {
    let url = url.filter(|u| !u.is_empty())?;
    let (dir, file) = url.rsplit_once('/')?;
    let lower = file.to_ascii_lowercase();
    let stem = lower
        .strip_suffix(".jpg")
        .or_else(|| lower.strip_suffix(".png"));
    let resizable = stem.is_some_and(|s| {
        let core = s.split_once("bb").map_or("", |(dims, rest)| {
            if rest.is_empty()
                || rest
                    .strip_prefix('-')
                    .is_some_and(|n| n.chars().all(|c| c.is_ascii_digit()) && !n.is_empty())
            {
                dims
            } else {
                ""
            }
        });
        core.split_once('x').is_some_and(|(w, h)| {
            !w.is_empty() && !h.is_empty() && w.chars().chain(h.chars()).all(|c| c.is_ascii_digit())
        })
    });
    Some(if resizable {
        format!("{dir}/{size}x{size}bb.jpg")
    } else {
        url.to_string()
    })
}

fn title(raw: &RawBook) -> String {
    raw.track_name
        .clone()
        .or(raw.track_censored_name.clone())
        .unwrap_or_else(|| "Untitled".into())
}

fn artwork(raw: &RawBook) -> Option<&str> {
    raw.artwork_url100
        .as_deref()
        .or(raw.artwork_url60.as_deref())
}

// iTunes rates 0–5; the shared DTO is 0–10.
fn ten_point(rating: Option<f64>) -> f64 {
    rating.map_or(0.0, |r| r * 2.0)
}

fn map_item(raw: RawBook) -> MediaItem {
    let year: String = raw
        .release_date
        .as_deref()
        .unwrap_or_default()
        .chars()
        .take(4)
        .collect();
    MediaItem {
        overview: strip_html(raw.description.as_deref().unwrap_or_default()),
        poster_path: upscale_cover(artwork(&raw), 600),
        vote_average: ten_point(raw.average_user_rating),
        vote_count: raw.user_rating_count.unwrap_or(0),
        release_date: (!year.is_empty()).then_some(year),
        author: Some(raw.artist_name.clone().unwrap_or_default()),
        ..MediaItem::new(
            Id::Str(raw.track_id.to_string()),
            title(&raw),
            MediaType::Book,
            PROVIDER,
        )
    }
}

// iTunes ignores `offset`, so a search is always one page.
fn map_page(raw: RawSearch, page: u32) -> Page<MediaItem> {
    let count = raw.results.len() as u32;
    Page {
        results: raw.results.into_iter().map(map_item).collect(),
        page,
        total_pages: page,
        total_results: raw.result_count.unwrap_or(count),
    }
}

fn map_detail(raw: RawBook) -> MediaDetail {
    let author = raw.artist_name.clone().unwrap_or_default();
    MediaDetail {
        tagline: author.clone(),
        overview: strip_html(raw.description.as_deref().unwrap_or_default()),
        poster_path: upscale_cover(artwork(&raw), 1200),
        vote_average: ten_point(raw.average_user_rating),
        vote_count: raw.user_rating_count.unwrap_or(0),
        release_date: raw.release_date.clone().unwrap_or_default(),
        genres: raw
            .genres
            .iter()
            .map(|g| Genre {
                id: Id::Str(g.clone()),
                name: g.clone(),
            })
            .collect(),
        subjects: Some(raw.genres.clone()),
        author: Some(author),
        ..MediaDetail::new(
            Id::Str(raw.track_id.to_string()),
            title(&raw),
            MediaType::Book,
            PROVIDER,
        )
    }
}

fn book_genres() -> Vec<GenreOption> {
    BOOK_GENRES
        .iter()
        .map(|(id, name)| GenreOption {
            id: Id::Str((*id).into()),
            name: (*name).into(),
        })
        .collect()
}

pub(crate) struct Itunes;

impl Provider for Itunes {
    async fn genres(&self) -> Result<Vec<GenreOption>, String> {
        Ok(book_genres())
    }

    async fn page(
        &self,
        query: &str,
        page: u32,
        genre: Option<Id>,
    ) -> Result<Page<MediaItem>, String> {
        if page > 1 {
            return Ok(Page {
                results: Vec::new(),
                page,
                total_pages: page,
                total_results: 0,
            });
        }
        let term = search_term(query, genre.as_ref().and_then(Id::as_str));
        let limit = PAGE_SIZE.to_string();
        let req = http().get(format!("{BASE}/search")).query(&[
            ("media", "ebook"),
            ("country", COUNTRY),
            ("term", term.as_str()),
            ("limit", limit.as_str()),
        ]);
        Ok(map_page(fetch("itunes", "search", req).await?, page))
    }

    // Omits the media filter because /lookup is brittle with media=ebook.
    async fn detail(&self, id: Id) -> Result<MediaDetail, String> {
        let id = match &id {
            Id::Str(s) => s.clone(),
            Id::Num(n) => n.to_string(),
        };
        let req = http()
            .get(format!("{BASE}/lookup"))
            .query(&[("id", id.as_str()), ("country", COUNTRY)]);
        let res: RawSearch = fetch("itunes", "details", req).await?;
        let book = res.results.into_iter().next().ok_or("Book not found.")?;
        Ok(map_detail(book))
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
    fn search_term_combines_query_and_genre() {
        assert_eq!(
            search_term("dune", Some("science fiction")),
            "dune science fiction"
        );
        assert_eq!(search_term("  dune  ", None), "dune");
        assert_eq!(search_term("popular", Some("mystery")), "mystery");
        assert_eq!(search_term("", Some("  ")), "fiction");
    }

    #[test]
    fn uses_the_us_store() {
        assert_eq!(COUNTRY, "us");
    }

    #[test]
    fn book_genres_are_the_curated_english_keywords() {
        let g = book_genres();
        assert_eq!(g.len(), 20);
        assert_eq!(g[0].id, Id::Str("romance".into()));
        assert!(g.iter().any(|x| x.name == "Science Fiction"));
    }

    #[test]
    fn upscale_cover_rewrites_the_size_suffix_only() {
        let u = |s| upscale_cover(Some(s), 600);
        assert_eq!(
            u("https://a/x/100x100bb.jpg").unwrap(),
            "https://a/x/600x600bb.jpg"
        );
        assert_eq!(
            u("https://a/x/60x60bb-85.PNG").unwrap(),
            "https://a/x/600x600bb.jpg"
        );
        assert_eq!(u("https://a/x/cover.jpg").unwrap(), "https://a/x/cover.jpg");
        assert_eq!(upscale_cover(None, 600), None);
        assert_eq!(upscale_cover(Some(""), 600), None);
    }

    #[test]
    fn search_maps_books_with_string_ids_and_a_next_page_hint() {
        let page = map_page(sample("itunes_search"), 1);
        let first = &page.results[0];
        assert_eq!(first.media_key, format!("itunes:book:{}", first.id));
        assert_eq!(page.results.len(), 3);
        assert_eq!(page.total_pages, 1);
        assert!(matches!(first.id, Id::Str(_)));
        assert_eq!(first.media_type, MediaType::Book);
        assert!(first
            .poster_path
            .as_deref()
            .unwrap()
            .ends_with("/600x600bb.jpg"));
        assert!(first.author.is_some());
    }

    #[test]
    fn search_is_a_single_page_because_itunes_ignores_offset() {
        let raw = RawSearch {
            result_count: None,
            results: (0..24u64)
                .map(|i| decode("t", serde_json::json!({ "trackId": i })).unwrap())
                .collect(),
        };
        let page = map_page(raw, 1);
        assert_eq!(page.total_pages, 1);
        assert_eq!(page.total_results, 24);
    }

    #[test]
    fn lookup_maps_detail_with_subjects() {
        let res: RawSearch = sample("itunes_lookup");
        let d = map_detail(res.results.into_iter().next().unwrap());
        assert_eq!(d.media_key, format!("itunes:book:{}", d.id));
        assert!(d.poster_path.unwrap().ends_with("/1200x1200bb.jpg"));
        assert_eq!(d.tagline, d.author.clone().unwrap());
        assert_eq!(d.subjects.as_ref().unwrap().len(), d.genres.len());
        assert_eq!(d.runtime, None);
    }

    #[test]
    fn ratings_are_on_the_shared_ten_point_scale() {
        let page = map_page(sample("itunes_search"), 1);
        assert_eq!(page.results[0].vote_average, 8.0);
        let res: RawSearch = sample("itunes_lookup");
        let d = map_detail(res.results.into_iter().next().unwrap());
        assert_eq!(d.vote_average, 8.0);
    }
}
