# tauri-app — API Reference

> The three IPC commands, the `Provider` trait behind them, and the shared types they return.

## Overview

All data comes from four third-party APIs. The Rust backend calls them through the shared `reqwest` client (`src-tauri/src/api/http.rs`), maps every response into typed DTOs, and the frontend calls Rust through three typed `invoke()`s. There is no per-provider code in TypeScript.

```
UI → src/lib/api/catalog.ts → invoke("catalog_*") → src-tauri/src/api/catalog.rs
   → match media_type → impl Provider (tmdb | anilist | rawg | itunes)
   → Raw* serde structs → pure map_* fns → DTOs in src-tauri/src/api/types.rs
```

- Commands return `Result<T, String>` where `T` is a `Serialize` DTO. Errors are English, user-facing strings; the frontend receives them as a rejected promise.
- `http.rs` turns non-2xx responses into the provider's own message, adds `(retry after Ns)` on 429, logs a one-line summary (status, result count) and never logs a URL or body, so API keys never reach logs or the UI.
- Commands are registered in `src-tauri/src/lib.rs` inside `tauri::generate_handler![]`.

## IPC commands (`src-tauri/src/api/catalog.rs`)

| Command | Args (snake_case) | Returns |
| --- | --- | --- |
| `catalog_genres` | `media_type: MediaType` | `GenreOption[]` |
| `catalog_page` | `media_type: MediaType, query: string, page: u32, genre: Id \| null` | `Page<MediaItem>` |
| `catalog_detail` | `media_type: string, id: string` | `MediaDetail` |

- An empty `query` is the "discover" view; a non-empty one is search.
- `catalog_detail` takes raw URL segments. Rust validates them: an unknown type rejects with "Invalid media type."; a non-numeric id for anything but books rejects with "Invalid ID.".

### Frontend (`src/lib/api/catalog.ts`)

```typescript
catalog.fetchGenres(cat: MediaType)                                  → GenreOption[]
catalog.fetchPage(cat, query: string, page: number, genre: GenreId | null) → PaginatedResult<MediaItem>
catalog.fetchDetail(type: string, id: string)                        → MediaDetail   // id is URL-decoded
```

Components never call `invoke` directly; stores and routes go through `catalog`.

## The `Provider` trait

```rust
pub(crate) trait Provider {
    async fn genres(&self) -> Result<Vec<GenreOption>, String>;
    async fn page(&self, query: &str, page: u32, genre: Option<Id>) -> Result<Page<MediaItem>, String>;
    async fn detail(&self, id: Id) -> Result<MediaDetail, String>;
}
```

Dispatch is a static `match` on `MediaType`: movie/tv → `Tmdb(media_type)`, anime/manga → `Anilist(media_type)`, game → `Rawg`, book → `Itunes`. Each provider module holds private `Raw*` serde structs and pure `map_*` functions, unit-tested on real saved responses in `src-tauri/tests/fixtures/`.

---

## TMDB — movies and TV (`src-tauri/src/api/tmdb.rs`)

- Base `https://api.themoviedb.org/3`, `api_key` query param (`TMDB_API_KEY`), `language=en-US`.
- Genres: `/genre/{movie|tv}/list`.
- Page: search → `/search/{kind}` (genre ignored); a genre → `/discover/{kind}?with_genres=…&sort_by=popularity.desc`; otherwise `/{kind}/popular`.
- Detail: `/{kind}/{id}?append_to_response=credits,videos`.
- Mapping: images become absolute URLs (`w342` poster / `w780` backdrop in lists, `w500` / `w1280` on detail, `w185` profiles); cast is the first 20 credits; videos are YouTube only.

## AniList — anime and manga (`src-tauri/src/api/anilist.rs`)

- GraphQL POST to `https://graphql.anilist.co`, no key. Errors inside a 200 body (`errors[].message`) become `Err`.
- Genres: `GenreCollection` (the name is the id).
- Page: `Page(perPage: 20) { media(type, search, genre, isAdult: false) }`, sorted `SEARCH_MATCH` with a query and `POPULARITY_DESC` without.
- Mapping: title `english` → `romaji` → `native`; scores 0–100 → 0–10; HTML stripped from descriptions; fuzzy dates become `YYYY-MM-DD`; manga `author` from story/art/original staff; trailer only when hosted on YouTube.

## RAWG — games (`src-tauri/src/api/rawg.rs`)

- Base `https://api.rawg.io/api`, `key` query param (`RAWG_API_KEY`).
- Genres: `/genres?page_size=40` (the slug is the id).
- Page: `/games?page_size=20` with `ordering=-added` (discover) or `search=…&search_precise=true`, plus `genres=<slug>`. `total_pages` is capped at 500 because RAWG refuses deep paging.
- Detail: `/games/{id}` and `/games/{id}/screenshots` in parallel (`tokio::join!`); screenshots are optional.
- Mapping: rating 0–5 → 0–10; `runtime` = playtime hours × 60; platforms, developer, publisher, studios and screenshots filled in.

## iTunes Search — books (`src-tauri/src/api/itunes.rs`)

- Base `https://itunes.apple.com`, no key, `country=us`.
- Genres: 20 curated English keywords in Rust (`BOOK_GENRES`), no request.
- Page: `/search?media=ebook&limit=20`. Apple ignores `genreId` for ebooks, so the keyword is folded into `term`; an empty query with no genre searches `fiction`. Apple also ignores `offset`, so a search is always one page (`total_pages = page`, no request for page > 1).
- Detail: `/lookup?id=…&country=us` (no media filter; it's brittle with `media=ebook`).
- Mapping: ids are strings (`trackId`); covers upscaled by URL rewrite (600 px in lists, 1200 px on detail); `runtime` is always `null`. `vote_average` is Apple's 0–5 rating as is (not normalised).

---

## Shared types

Rust `src-tauri/src/api/types.rs` is the source; `src/lib/types/media.ts` mirrors it by hand. `src/lib/types/media.contract.test.ts` checks both ways against `src/lib/types/contract.fixture.json`, which a Rust test writes (`UPDATE_CONTRACT=1 cargo test contract`).

```typescript
type MediaType  = "movie" | "tv" | "anime" | "manga" | "book" | "game";
type ProviderId = "tmdb" | "anilist" | "rawg" | "itunes" | "manual";   // manual: user-created (S2+)
type MediaKey   = string;                                               // "provider:media_type:id"
type GenreId    = number | string;                                      // number for TMDB, string otherwise

interface PaginatedResult<T> { results: T[]; page: number; total_pages: number; total_results: number; }
interface GenreOption { id: GenreId; name: string; }

interface MediaItem {
  id: number | string; provider: ProviderId; media_key: MediaKey; media_type: MediaType;
  title: string; overview: string;
  poster_path: string | null; backdrop_path: string | null;   // absolute URLs
  vote_average: number; vote_count: number;
  release_date?; first_air_date?; genre_ids?; author?; episodes?; chapters?;
}

interface MediaDetail {
  id; provider; media_key; media_type; title; tagline; overview;
  poster_path; backdrop_path; vote_average; vote_count; release_date: string;
  runtime: number | null;                                     // minutes
  genres: Genre[]; cast: CastMember[]; videos: VideoClip[];
  author?; episodes?; chapters?; volumes?; status?; studios?; subjects?;
  developer?; publisher?; platforms?; screenshots?;
}
```

- **`media_key`** is the identity of an item across the app (`tmdb:movie:969681`, `itunes:book:1502418197`). `MediaItem::new` / `MediaDetail::new` derive it from the provider, so every mapper sets it in one place. Lists are keyed by it and de-duplicated by it.
- Optional fields are omitted from the JSON when empty (`skip_serializing_if`).
- Helpers in `media.ts`: `getPosterUrl`, `getYear`, `getRating`, `MEDIA_LABELS`, `GENRE_SUPPORTED`.

## Adding a provider

Follow the checklist in `AGENTS.md` ("Adding a provider"): saved fixtures → module with `Raw*` structs and tested `map_*` fns → `impl Provider` → arms in the three `catalog.rs` matches → `mod.rs` → e2e fixture if the home tab changes → `cargo test live_ -- --ignored` → `npm run verify`.
