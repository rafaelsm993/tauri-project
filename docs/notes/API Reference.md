# Aevum — API Reference

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

### Connectivity (`src-tauri/src/api/http.rs`)

| Command | Args | Returns |
| --- | --- | --- |
| `network_check` | — | `boolean` |

One keyless HEAD request (iTunes, 5 s timeout); any HTTP answer is online. It emits the same `network` event as provider calls, so the Offline pill updates on screens that make no provider calls. The root layout calls it via `checkNetwork()` (`src/lib/api/offline.ts`) after every navigation, every 30 s and on window focus.

### Backup (`src-tauri/src/backup/ipc.rs`)

| Command | Args | Returns |
| --- | --- | --- |
| `backup_export` | `at: string` (ISO time) | `ExportReport \| null` (null: dialog closed) |
| `backup_pick_import` | — | `ImportPreview \| null`; keeps the parsed backup pending |
| `backup_apply_import` | `mode: "merge" \| "replace"` | `ImportReport` |
| `backup_cancel_import` | — | — |

The zip holds `manifest.json`, `library.json`, `events.jsonl`, `prefs.json` and `posters/`; API keys are never in it. The native file dialogs run in Rust, so the WebView has no dialog or fs permission. Import rejects zip-slip paths, oversized archives and files from a newer app before anything changes. Merge keeps every item and takes the newer `updated_at`; replace first writes `pre-import-backup.zip` next to `library.json` and returns its path as `safety_copy`. On Android the pickers return `content://` documents, opened through `tauri-plugin-fs` from Rust (`backup/target.rs`; no `fs:` capability): export builds and verifies the zip in the app cache (`export-staging.zip`), copies it into the chosen document, reads it back and compares the bytes, then deletes the staging file; import reads the document through the same size cap. A copy cannot be atomic there, so a failed one names the file. `ExportReport.path` is the readable name (`Download/aevum-backup-2026-09-27.zip`, taken from the URI or, when the URI hides it as in Downloads' `msf:` ids, from where the written file really lives in shared storage; otherwise "the chosen file"), never the raw URI. Client: `src/lib/api/backup.ts`; UI: `BackupSection.svelte` on `/settings`.

### Activity log (`src-tauri/src/library/ipc.rs`)

| Command | Args | Returns |
| --- | --- | --- |
| `library_events` | — | `LibraryEvent[]` (oldest first by `at_utc`, stable; once per id — a merge import is re-sorted too) |

Read-only view of `events.jsonl`. The frontend derives everything the profile shows from it: XP, level, title, streak (`src/lib/domain/gamification.ts`) and the dashboard series (`src/lib/domain/dashboard.ts`), through `gamificationStore`. Each item pays once for its first add (5 XP), first rating (10) and first completion (50, +15/+40/+80 for a medium/long/epic length); progress clicks pay nothing and removing keeps XP. Level n needs `50 × n^1.5` XP. Values are placeholders until a playtest. Planner math is pure and frontend-only: `src/lib/domain/estimate.ts` (an item's total, done and remaining minutes, or the length fields still missing; dropped items are not planned) and `src/lib/domain/schedule.ts` (even sessions on the user's days from an injected start date; re-planning is the same call with what is left). Shared date helpers live in `src/lib/domain/calendar.ts`. `src/lib/domain/planner.ts` turns the library into the planner page: planned items with sessions and a finish date, items that still need a length, a Monday-to-Sunday week, and how far an edit moves the finish date (never worded as being behind).

`library_add`, `library_update` and `library_remove` each require an `event`; the entry's `updated_at` (and `created_at` on add) is its `at_utc`. Before anything is saved, the command refuses an event with an empty `id`, a `media_key` other than the command's key, or a kind it does not log (add: `library_add`; update: `library_update` or `library_plan`; remove: `library_remove`). The kinds are Rust's `EventKind` and TS `EVENT_KINDS`, pinned by the library contract test; stored events keep `kind` as a string, so a newer log still reads.

Live updates: `library.onEvent(fn)` (in `src/lib/api/library.ts`) hands every event the backend logged to listeners, after the save succeeds (not a re-add of a saved item, which returns the existing entry, nor a remove of a missing one, which returns `false`); `gamificationStore` appends it (once per id), so the level moves without re-reading the log. A level-up is decided by the pure `celebration(seen, level)` against `prefs.seen_level` (last level congratulated; `0` = adopt the current level silently), which `prefs_update` persists; the store also keeps the highest level congratulated this session, so a failed or stale settings write cannot repeat a toast, and outside an import the saved level never goes down (an import adopts the new level, up or down, without a toast). The layout loads the level only after the library loaded.

Plans: `library.plan(key, plan | null)` sends `library_update` with `{ plan }` and logs a `library_plan` event, which earns no XP and does not count as an active day. In a `library_update` patch an absent field is left alone and `null` clears it (`rating`, `review`, `plan`). A plan is `{ days (0 = Monday … 6 = Sunday, distinct), max_session_minutes (5–720), since (YYYY-MM-DD) }`; sessions are never stored. `prefs.reading_pages_per_hour` (5–300, `null` until a book is first planned) sets the reading pace.

Reminders (`src/lib/domain/reminders.ts`, `src/lib/stores/reminders.svelte.ts`) add no command and no storage. A plan starts on `max(today, since)`. Today's session is due unless that day logged progress or a status change for the item, or a `library_plan` moving `since` past today. Done and Next session both save the plan with `since = tomorrow`. Later hides the toast for 3 h in memory only. Earlier plan days in the last 7 with nothing logged are counted as re-planned. Checks run on launch, window `focus` and `visibilitychange` to visible, never on a timer; shown / snoozed / done / next session go to the app log at info level, not to `events.jsonl`.

### Startup (`src-tauri/src/startup.rs`)

| Command | Args | Returns |
| --- | --- | --- |
| `startup_status` | — | `StartupProblem \| null` |

If `library.json` or `prefs.json` is from a newer app or cannot be read, setup keeps the file untouched, skips the library and prefs state, and the root layout shows `StartupProblem.svelte` (why, the data folder, a copy button) instead of the app.

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
