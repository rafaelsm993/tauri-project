use super::catalog::Provider;
use super::http::{client as http, decode, fetch_json};
use super::types::{
    round1, strip_html, CastMember, Genre, GenreOption, Id, MediaDetail, MediaItem, MediaType,
    Page, ProviderId, VideoClip,
};
use serde::Deserialize;
use serde_json::{json, Value};

const PROVIDER: ProviderId = ProviderId::Anilist;

const ENDPOINT: &str = "https://graphql.anilist.co";

// AniList caps perPage at 50; 20 matches the other providers.
const PAGE_SIZE: u32 = 20;

const MEDIA_LIST_FIELDS: &str = r#"
    id
    type
    format
    status
    episodes
    chapters
    volumes
    averageScore
    popularity
    genres
    bannerImage
    coverImage { extraLarge large medium }
    title { romaji english native userPreferred }
    startDate { year month day }
    description(asHtml: false)
"#;

const MEDIA_DETAIL_FIELDS: &str = r#"
    id
    type
    format
    status
    episodes
    chapters
    volumes
    duration
    averageScore
    meanScore
    popularity
    favourites
    genres
    bannerImage
    coverImage { extraLarge large medium }
    title { romaji english native userPreferred }
    startDate { year month day }
    endDate { year month day }
    season
    seasonYear
    description(asHtml: false)
    siteUrl
    studios(isMain: true) { nodes { id name } }
    staff(perPage: 6) { edges { role node { id name { full } } } }
    characters(perPage: 20, sort: ROLE) {
      edges {
        role
        node { id name { full } image { large medium } }
      }
    }
    trailer { id site thumbnail }
"#;

// AniList reports errors in a 200 body as `{ errors: [{ message }] }`.
fn check_graphql(v: &Value) -> Result<(), String> {
    if let Some(arr) = v.get("errors").and_then(|e| e.as_array()) {
        if !arr.is_empty() {
            let msg = arr
                .iter()
                .filter_map(|e| e.get("message").and_then(|m| m.as_str()))
                .collect::<Vec<_>>()
                .join("; ");
            return Err(format!("AniList: {}", msg));
        }
    }
    Ok(())
}

async fn graphql(op: &str, query: &str, variables: Value) -> Result<Value, String> {
    let body = json!({ "query": query, "variables": variables });
    let req = http()
        .post(ENDPOINT)
        .header("Accept", "application/json")
        .json(&body);
    let res = fetch_json("anilist", op, req).await?;
    check_graphql(&res)?;
    Ok(res)
}

// Without a search term, sorts by popularity so discover matches the other providers.
fn list_query(media_type: &str) -> String {
    format!(
        r#"
        query ($page: Int, $perPage: Int, $search: String, $genre: String, $sort: [MediaSort]) {{
          Page(page: $page, perPage: $perPage) {{
            pageInfo {{ total currentPage lastPage hasNextPage perPage }}
            media(type: {media_type}, search: $search, genre: $genre, sort: $sort, isAdult: false) {{
              {fields}
            }}
          }}
        }}
        "#,
        media_type = media_type,
        fields = MEDIA_LIST_FIELDS
    )
}

fn detail_query() -> String {
    format!(
        r#"
        query ($id: Int) {{
          Media(id: $id) {{
            {fields}
          }}
        }}
        "#,
        fields = MEDIA_DETAIL_FIELDS
    )
}

const MAX_CAST: usize = 20;

#[derive(Deserialize)]
struct Gql<T> {
    data: Option<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct PageData {
    page: Option<RawPage>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPage {
    page_info: Option<RawPageInfo>,
    #[serde(default)]
    media: Vec<RawMedia>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPageInfo {
    total: Option<u32>,
    current_page: Option<u32>,
    last_page: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct MediaData {
    media: Option<RawMedia>,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct GenreData {
    #[serde(default)]
    genre_collection: Vec<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawMedia {
    id: u64,
    title: Option<RawTitle>,
    description: Option<String>,
    cover_image: Option<RawCover>,
    banner_image: Option<String>,
    average_score: Option<f64>,
    mean_score: Option<f64>,
    popularity: Option<u64>,
    start_date: Option<RawDate>,
    episodes: Option<u32>,
    chapters: Option<u32>,
    volumes: Option<u32>,
    duration: Option<u32>,
    status: Option<String>,
    #[serde(default)]
    genres: Vec<String>,
    studios: Option<RawNodes<RawName>>,
    staff: Option<RawEdges<RawStaffNode>>,
    characters: Option<RawEdges<RawCharacterNode>>,
    trailer: Option<RawTrailer>,
}

#[derive(Deserialize, Default)]
struct RawTitle {
    english: Option<String>,
    romaji: Option<String>,
    native: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawCover {
    extra_large: Option<String>,
    large: Option<String>,
    medium: Option<String>,
}

#[derive(Deserialize)]
struct RawDate {
    year: Option<u32>,
    month: Option<u32>,
    day: Option<u32>,
}

#[derive(Deserialize)]
struct RawNodes<T> {
    #[serde(default = "Vec::new")]
    nodes: Vec<T>,
}

#[derive(Deserialize)]
struct RawEdges<T> {
    #[serde(default = "Vec::new")]
    edges: Vec<RawEdge<T>>,
}

#[derive(Deserialize)]
struct RawEdge<T> {
    role: Option<String>,
    node: Option<T>,
}

#[derive(Deserialize)]
struct RawName {
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawFullName {
    full: Option<String>,
}

#[derive(Deserialize)]
struct RawStaffNode {
    name: Option<RawFullName>,
}

#[derive(Deserialize)]
struct RawCharacterNode {
    id: Option<u64>,
    name: Option<RawFullName>,
    image: Option<RawCover>,
}

#[derive(Deserialize)]
struct RawTrailer {
    id: Option<String>,
    site: Option<String>,
}

fn non_empty(s: Option<String>) -> Option<String> {
    s.filter(|v| !v.is_empty())
}

// English title first, then romaji, then native.
fn pick_title(title: Option<RawTitle>) -> String {
    let t = title.unwrap_or_default();
    non_empty(t.english)
        .or(non_empty(t.romaji))
        .or(non_empty(t.native))
        .unwrap_or_else(|| "Untitled".into())
}

fn pick_image(cover: Option<RawCover>) -> Option<String> {
    let c = cover?;
    non_empty(c.extra_large)
        .or(non_empty(c.large))
        .or(non_empty(c.medium))
}

fn fuzzy_date(d: Option<RawDate>) -> String {
    match d {
        Some(RawDate {
            year: Some(y),
            month,
            day,
        }) if y > 0 => format!("{y}-{:02}-{:02}", month.unwrap_or(1), day.unwrap_or(1)),
        _ => String::new(),
    }
}

// AniList scores are 0-100; the UI uses 0-10.
fn score10(s: Option<f64>) -> f64 {
    s.filter(|v| *v > 0.0).map_or(0.0, |v| round1(v / 10.0))
}

fn full_name(n: Option<RawFullName>) -> Option<String> {
    n.and_then(|n| n.full)
}

fn map_item(raw: RawMedia, media_type: MediaType) -> MediaItem {
    let is_manga = media_type == MediaType::Manga;
    MediaItem {
        overview: strip_html(raw.description.as_deref().unwrap_or_default()),
        poster_path: pick_image(raw.cover_image),
        backdrop_path: raw.banner_image,
        vote_average: score10(raw.average_score),
        vote_count: raw.popularity.unwrap_or(0),
        release_date: Some(fuzzy_date(raw.start_date)),
        episodes: if is_manga { None } else { raw.episodes },
        chapters: if is_manga { raw.chapters } else { None },
        ..MediaItem::new(Id::Num(raw.id), pick_title(raw.title), media_type, PROVIDER)
    }
}

fn map_page(raw: Option<RawPage>, media_type: MediaType) -> Page<MediaItem> {
    let raw = raw.unwrap_or(RawPage {
        page_info: None,
        media: Vec::new(),
    });
    let count = raw.media.len() as u32;
    let info = raw.page_info;
    Page {
        results: raw
            .media
            .into_iter()
            .map(|m| map_item(m, media_type))
            .collect(),
        page: info.as_ref().and_then(|i| i.current_page).unwrap_or(1),
        total_pages: info.as_ref().and_then(|i| i.last_page).unwrap_or(1),
        total_results: info.and_then(|i| i.total).unwrap_or(count),
    }
}

// Manga credits: only story/art/original staff.
fn author(staff: Option<RawEdges<RawStaffNode>>) -> String {
    staff
        .map(|s| s.edges)
        .unwrap_or_default()
        .into_iter()
        .filter(|e| {
            let role = e.role.as_deref().unwrap_or_default().to_lowercase();
            ["story", "art", "original"]
                .iter()
                .any(|k| role.contains(k))
        })
        .filter_map(|e| non_empty(full_name(e.node.and_then(|n| n.name))))
        .collect::<Vec<_>>()
        .join(", ")
}

fn map_detail(raw: RawMedia, media_type: MediaType) -> MediaDetail {
    let is_manga = media_type == MediaType::Manga;
    let cast = raw
        .characters
        .map(|c| c.edges)
        .unwrap_or_default()
        .into_iter()
        .take(MAX_CAST)
        .map(|e| {
            let node = e.node;
            CastMember {
                id: node.as_ref().and_then(|n| n.id).unwrap_or(0),
                character: e
                    .role
                    .map(|r| r.replacen('_', " ", 1).to_lowercase())
                    .unwrap_or_default(),
                profile_path: node.as_ref().and_then(|n| {
                    n.image
                        .as_ref()
                        .and_then(|i| i.large.clone().or(i.medium.clone()))
                }),
                name: full_name(node.and_then(|n| n.name)).unwrap_or_default(),
            }
        })
        .collect();
    let videos = match raw.trailer {
        Some(RawTrailer {
            id: Some(key),
            site: Some(site),
        }) if !key.is_empty() && site == "youtube" => vec![VideoClip {
            key,
            site: "YouTube".into(),
            kind: "Trailer".into(),
            name: "Trailer".into(),
        }],
        _ => Vec::new(),
    };
    let studios = raw
        .studios
        .map(|s| s.nodes)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|n| non_empty(n.name))
        .collect();
    MediaDetail {
        overview: strip_html(raw.description.as_deref().unwrap_or_default()),
        poster_path: pick_image(raw.cover_image),
        backdrop_path: raw.banner_image,
        vote_average: score10(raw.average_score.or(raw.mean_score)),
        vote_count: raw.popularity.unwrap_or(0),
        release_date: fuzzy_date(raw.start_date),
        runtime: raw.duration,
        genres: raw
            .genres
            .into_iter()
            .map(|g| Genre {
                id: Id::Str(g.clone()),
                name: g,
            })
            .collect(),
        cast,
        videos,
        episodes: if is_manga { None } else { raw.episodes },
        chapters: if is_manga { raw.chapters } else { None },
        volumes: if is_manga { raw.volumes } else { None },
        status: Some(raw.status.unwrap_or_default()),
        studios: Some(studios),
        author: is_manga.then(|| author(raw.staff)),
        ..MediaDetail::new(Id::Num(raw.id), pick_title(raw.title), media_type, PROVIDER)
    }
}

// Without a search term, sorts by popularity so discover matches the other providers.
fn list_variables(query: &str, page: u32, genre: Option<&str>) -> Value {
    let q = query.trim();
    let mut vars = json!({
        "page": page,
        "perPage": PAGE_SIZE,
        "sort": [if q.is_empty() { "POPULARITY_DESC" } else { "SEARCH_MATCH" }],
    });
    if !q.is_empty() {
        vars["search"] = json!(q);
    }
    if let Some(g) = genre.filter(|s| !s.is_empty()) {
        vars["genre"] = json!(g);
    }
    vars
}

async fn graphql_data<T: serde::de::DeserializeOwned>(
    op: &str,
    query: &str,
    variables: Value,
) -> Result<Option<T>, String> {
    let gql: Gql<T> = decode("anilist", graphql(op, query, variables).await?)?;
    Ok(gql.data)
}

// AniList serves anime and manga with the same schema; the media type picks the list.
pub(crate) struct Anilist(pub MediaType);

impl Anilist {
    fn gql_type(&self) -> &'static str {
        if self.0 == MediaType::Manga {
            "MANGA"
        } else {
            "ANIME"
        }
    }
}

impl Provider for Anilist {
    async fn genres(&self) -> Result<Vec<GenreOption>, String> {
        let data: Option<GenreData> =
            graphql_data("genres", "query { GenreCollection }", json!({})).await?;
        Ok(data
            .map(|d| d.genre_collection)
            .unwrap_or_default()
            .into_iter()
            .map(|g| GenreOption {
                id: Id::Str(g.clone()),
                name: g,
            })
            .collect())
    }

    async fn page(
        &self,
        query: &str,
        page: u32,
        genre: Option<Id>,
    ) -> Result<Page<MediaItem>, String> {
        let vars = list_variables(query, page, genre.as_ref().and_then(Id::as_str));
        let op = if vars.get("search").is_some() {
            "search"
        } else {
            "discover"
        };
        let data: Option<PageData> = graphql_data(op, &list_query(self.gql_type()), vars).await?;
        Ok(map_page(data.and_then(|d| d.page), self.0))
    }

    async fn detail(&self, id: Id) -> Result<MediaDetail, String> {
        let id = id.as_num().ok_or("Invalid ID.")?;
        let data: Option<MediaData> =
            graphql_data("details", &detail_query(), json!({ "id": id })).await?;
        let not_found = if self.0 == MediaType::Manga {
            "Manga not found."
        } else {
            "Anime not found."
        };
        let media = data.and_then(|d| d.media).ok_or(not_found)?;
        Ok(map_detail(media, self.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample<T: serde::de::DeserializeOwned>(name: &str) -> T {
        let path = format!("{}/tests/fixtures/{name}.json", env!("CARGO_MANIFEST_DIR"));
        let text = std::fs::read_to_string(path).unwrap();
        let gql: Gql<T> = decode("test", serde_json::from_str(&text).unwrap()).unwrap();
        gql.data.unwrap()
    }

    fn title(
        english: Option<&str>,
        romaji: Option<&str>,
        native: Option<&str>,
    ) -> Option<RawTitle> {
        Some(RawTitle {
            english: english.map(Into::into),
            romaji: romaji.map(Into::into),
            native: native.map(Into::into),
        })
    }

    #[test]
    fn pick_title_prefers_english_then_romaji_then_native() {
        assert_eq!(
            pick_title(title(Some("Attack on Titan"), Some("Shingeki"), None)),
            "Attack on Titan"
        );
        assert_eq!(
            pick_title(title(Some(""), Some("Shingeki"), None)),
            "Shingeki"
        );
        assert_eq!(
            pick_title(title(None, None, Some("進撃の巨人"))),
            "進撃の巨人"
        ); // english-only: allow
        assert_eq!(pick_title(None), "Untitled");
    }

    #[test]
    fn fuzzy_date_pads_and_defaults_missing_parts() {
        let d = |y, m, day| {
            Some(RawDate {
                year: y,
                month: m,
                day,
            })
        };
        assert_eq!(fuzzy_date(d(Some(2013), Some(4), Some(7))), "2013-04-07");
        assert_eq!(fuzzy_date(d(Some(2013), None, None)), "2013-01-01");
        assert_eq!(fuzzy_date(d(None, Some(4), None)), "");
        assert_eq!(fuzzy_date(None), "");
    }

    #[test]
    fn score10_scales_and_zeroes_missing_scores() {
        assert_eq!(score10(Some(84.0)), 8.4);
        assert_eq!(score10(Some(0.0)), 0.0);
        assert_eq!(score10(None), 0.0);
    }

    #[test]
    fn anime_page_maps_items_and_page_info() {
        let data: PageData = sample("anilist_anime_page");
        let page = map_page(data.page, MediaType::Anime);
        let first = &page.results[0];
        assert_eq!(first.media_key, format!("anilist:anime:{}", first.id));
        assert_eq!(page.results.len(), 3);
        assert_eq!(page.page, 1);
        assert!(page.total_pages > 1 && page.total_results > 3);
        assert_eq!(first.media_type, MediaType::Anime);
        assert!(first.poster_path.is_some() && first.vote_average <= 10.0);
        assert!(first.chapters.is_none());
        assert!(!first.overview.contains('<'));
    }

    #[test]
    fn anime_detail_maps_trailer_cast_and_studios() {
        let data: MediaData = sample("anilist_anime_detail");
        let d = map_detail(data.media.unwrap(), MediaType::Anime);
        assert_eq!(d.title, "Attack on Titan");
        assert_eq!(d.release_date, "2013-04-07");
        assert!(!d.cast.is_empty() && d.cast.len() <= MAX_CAST);
        assert!(d
            .cast
            .iter()
            .all(|c| c.character == c.character.to_lowercase()));
        assert!(d.videos.iter().all(|v| v.site == "YouTube"));
        assert!(!d.studios.unwrap().is_empty());
        assert!(d.author.is_none() && d.volumes.is_none());
        assert_eq!(d.genres[0].id, Id::Str(d.genres[0].name.clone()));
    }

    #[test]
    fn manga_detail_credits_story_and_art_staff() {
        let data: MediaData = sample("anilist_manga_detail");
        let d = map_detail(data.media.unwrap(), MediaType::Manga);
        assert_eq!(d.media_key, format!("anilist:manga:{}", d.id));
        assert_eq!(d.title, "Berserk");
        assert!(d.author.as_deref().unwrap().contains("Kentarou Miura"));
        assert!(d.episodes.is_none());
    }

    #[test]
    fn missing_trailer_site_yields_no_videos() {
        let raw = RawMedia {
            id: 1,
            trailer: Some(RawTrailer {
                id: Some("x".into()),
                site: Some("dailymotion".into()),
            }),
            ..RawMedia::default()
        };
        assert!(map_detail(raw, MediaType::Anime).videos.is_empty());
    }

    #[test]
    fn genres_sample_decodes_to_slugs() {
        let data: GenreData = sample("anilist_genres");
        assert!(data.genre_collection.contains(&"Action".to_string()));
    }

    #[test]
    fn list_variables_switch_between_search_and_discover() {
        let v = list_variables("  naruto ", 2, Some("Action"));
        assert_eq!(v["search"], "naruto");
        assert_eq!(v["sort"][0], "SEARCH_MATCH");
        assert_eq!(v["genre"], "Action");
        let v = list_variables("", 1, Some(""));
        assert!(v.get("search").is_none() && v.get("genre").is_none());
        assert_eq!(v["sort"][0], "POPULARITY_DESC");
        assert_eq!(v["perPage"], PAGE_SIZE);
    }
}
