use super::anilist::Anilist;
use super::cache_disk::{cached, GENRES_TTL, PAGE_TTL};
use super::itunes::Itunes;
use super::rawg::Rawg;
use super::tmdb::Tmdb;
use super::types::{GenreOption, Id, MediaDetail, MediaItem, MediaType, Page};

// Common contract every provider implements; the facade dispatches on media type.
pub(crate) trait Provider {
    async fn genres(&self) -> Result<Vec<GenreOption>, String>;
    async fn page(
        &self,
        query: &str,
        page: u32,
        genre: Option<Id>,
    ) -> Result<Page<MediaItem>, String>;
    async fn detail(&self, id: Id) -> Result<MediaDetail, String>;
}

// Detail args come from the URL; books keep string ids, the rest must be numeric.
fn parse_detail_args(media_type: &str, id: &str) -> Result<(MediaType, Id), String> {
    let media_type = MediaType::parse(media_type)?;
    let id = match media_type {
        MediaType::Book => Id::Str(id.to_string()),
        _ => Id::Num(id.parse().map_err(|_| "Invalid ID.".to_string())?),
    };
    Ok((media_type, id))
}

// Disk-cache key for a genre list; books are local and never cached.
fn genres_key(media_type: MediaType) -> Option<String> {
    (media_type != MediaType::Book).then(|| format!("genres {media_type}"))
}

// Disk-cache key for a home carousel: first page, no search text.
fn home_page_key(
    media_type: MediaType,
    query: &str,
    page: u32,
    genre: Option<&Id>,
) -> Option<String> {
    if page != 1 || !query.trim().is_empty() {
        return None;
    }
    Some(match genre {
        Some(g) => format!("page {media_type} g={g}"),
        None => format!("page {media_type}"),
    })
}

async fn fetch_genres(media_type: MediaType) -> Result<Vec<GenreOption>, String> {
    match media_type {
        MediaType::Movie | MediaType::Tv => Tmdb(media_type).genres().await,
        MediaType::Anime | MediaType::Manga => Anilist(media_type).genres().await,
        MediaType::Game => Rawg.genres().await,
        MediaType::Book => Itunes.genres().await,
    }
}

async fn fetch_page(
    media_type: MediaType,
    query: &str,
    page: u32,
    genre: Option<Id>,
) -> Result<Page<MediaItem>, String> {
    match media_type {
        MediaType::Movie | MediaType::Tv => Tmdb(media_type).page(query, page, genre).await,
        MediaType::Anime | MediaType::Manga => Anilist(media_type).page(query, page, genre).await,
        MediaType::Game => Rawg.page(query, page, genre).await,
        MediaType::Book => Itunes.page(query, page, genre).await,
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn catalog_genres(media_type: MediaType) -> Result<Vec<GenreOption>, String> {
    log::debug!("[catalog] genres  {media_type:?}");
    match genres_key(media_type) {
        Some(key) => cached(&key, GENRES_TTL, || fetch_genres(media_type)).await,
        None => fetch_genres(media_type).await,
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn catalog_page(
    media_type: MediaType,
    query: String,
    page: u32,
    genre: Option<Id>,
) -> Result<Page<MediaItem>, String> {
    log::debug!("[catalog] page  {media_type:?} query={query:?} page={page} genre={genre:?}");
    match home_page_key(media_type, &query, page, genre.as_ref()) {
        Some(key) => {
            cached(&key, PAGE_TTL, || {
                fetch_page(media_type, &query, page, genre)
            })
            .await
        }
        None => fetch_page(media_type, &query, page, genre).await,
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn catalog_detail(media_type: String, id: String) -> Result<MediaDetail, String> {
    log::debug!("[catalog] detail  {media_type} id={id}");
    let (media_type, id) = parse_detail_args(&media_type, &id)?;
    match media_type {
        MediaType::Movie | MediaType::Tv => Tmdb(media_type).detail(id).await,
        MediaType::Anime | MediaType::Manga => Anilist(media_type).detail(id).await,
        MediaType::Game => Rawg.detail(id).await,
        MediaType::Book => Itunes.detail(id).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::types::MediaKey;

    #[test]
    fn detail_args_parse_numeric_ids_for_numeric_providers() {
        assert_eq!(
            parse_detail_args("movie", "550"),
            Ok((MediaType::Movie, Id::Num(550)))
        );
    }

    #[test]
    fn detail_args_keep_book_ids_as_strings() {
        assert_eq!(
            parse_detail_args("book", "abc/1"),
            Ok((MediaType::Book, Id::Str("abc/1".into())))
        );
    }

    #[test]
    fn detail_args_reject_bad_input_with_user_facing_messages() {
        assert_eq!(parse_detail_args("movie", "abc"), Err("Invalid ID.".into()));
        assert_eq!(
            parse_detail_args("podcast", "1"),
            Err("Invalid media type.".into())
        );
    }

    #[test]
    fn genre_lists_are_disk_cached_except_local_books() {
        assert_eq!(
            genres_key(MediaType::Movie).as_deref(),
            Some("genres movie")
        );
        assert_eq!(genres_key(MediaType::Book), None);
    }

    #[test]
    fn only_home_carousel_pages_are_disk_cached() {
        let g = Id::Num(28);
        assert_eq!(
            home_page_key(MediaType::Movie, "", 1, Some(&g)).as_deref(),
            Some("page movie g=28")
        );
        assert_eq!(
            home_page_key(MediaType::Game, "  ", 1, None).as_deref(),
            Some("page game")
        );
        assert_eq!(home_page_key(MediaType::Movie, "", 2, None), None);
        assert_eq!(home_page_key(MediaType::Movie, "star", 1, None), None);
    }

    // Hits the real providers; run with `cargo test live_ -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_every_provider_serves_genres_page_and_detail() {
        let all = [
            MediaType::Movie,
            MediaType::Tv,
            MediaType::Anime,
            MediaType::Manga,
            MediaType::Game,
            MediaType::Book,
        ];
        for mt in all {
            let genres = catalog_genres(mt).await.unwrap();
            assert!(!genres.is_empty(), "{mt:?} genres");
            let page = catalog_page(mt, String::new(), 1, Some(genres[0].id.clone()))
                .await
                .unwrap();
            let first = page
                .results
                .first()
                .unwrap_or_else(|| panic!("{mt:?} page"));
            let key = MediaKey::parse(&first.media_key).unwrap();
            assert_eq!(key.media_type, mt);
            let detail = catalog_detail(mt.to_string(), key.id).await.unwrap();
            assert_eq!(detail.media_key, first.media_key);
            let search = catalog_page(mt, "star".into(), 1, None).await.unwrap();
            assert!(!search.results.is_empty(), "{mt:?} search");
            eprintln!(
                "{}: {} genres, {} items, detail {:?}, search {}",
                first.media_key,
                genres.len(),
                page.results.len(),
                detail.title,
                search.total_results
            );
        }
    }
}
