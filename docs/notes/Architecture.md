# SESH — Architecture

> Tauri 2 app: a SvelteKit SPA calls a typed Rust facade for four media catalogs and local JSON storage.

## Overview

**Name.** *SESH*, renamed on 2026-10-29, with the identifier
`com.rafaelsm993.sesh`. Data saved under the old identifier moves once (see `CHANGELOG.md`).

SESH lets you browse movies, TV series, anime, manga, books and games. Home, Detail, Library, Profile, Planner, Settings and Welcome are implemented. The library, events, preferences and keys persist locally in the app data directory; there are no accounts or cloud sync.

```
┌──────────────────────────────────────────────────────────┐
│                 Tauri Window (WebView)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │            SvelteKit SPA (TypeScript)              │  │
│  │  Routes → Components → Stores → src/lib/api/catalog.ts │
│  │                                  │ invoke('catalog_*') │
│  └──────────────────────────────────┼─────────────────┘  │
│                                     │ Tauri IPC          │
│  ┌──────────────────────────────────┼─────────────────┐  │
│  │          Rust backend (Tauri 2)  ▼                 │  │
│  │   api/catalog.rs → impl Provider → map_* → DTOs    │  │
│  │     reqwest → TMDB · AniList · RAWG · iTunes       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Layers

### Frontend — SvelteKit SPA

- SvelteKit with `adapter-static`: no SSR and no server. TypeScript strict, Svelte 5 runes.
- SCSS variables and mixins are auto-injected; every color is a runtime `--clr-*` token from `global.css` (see [Design System](Design%20System.md)).
- Catalog data goes through `src/lib/api/catalog.ts` (three typed `invoke()`s); local storage and settings use sibling `src/lib/api/*` clients. The UI does no provider mapping.
- UI is English only; `npm run lint:en` enforces it.

### Backend — Rust / Tauri 2

- Tauri 2 with `tauri-plugin-opener` and `tauri-plugin-log`.
- `reqwest` 0.12 with `rustls-tls` (no OpenSSL) on Tokio, through one shared client (`src-tauri/src/api/http.rs`).
- Three commands in `src-tauri/src/api/catalog.rs` dispatch to a common `Provider` trait (`genres · page · detail`) implemented per provider. Each provider parses into private `Raw*` structs and maps them with pure `map_*` functions into the DTOs in `src-tauri/src/api/types.rs`. See [API Reference](API%20Reference.md).
- A Rust test writes `src/lib/types/contract.fixture.json`; `media.contract.test.ts` keeps `media.ts` in sync with the Rust DTOs.
- Local JSON stores manage the library, events, preferences and user-saved API keys.
- API keys: debug builds can compile `TMDB_API_KEY` and `RAWG_API_KEY` from `.env`; release builds blank them even if the environment sets them. At runtime the environment overrides a key saved in Settings → Keys, which overrides a debug compiled key.

### Identity

Every item carries `provider` and `media_key` (`provider:media_type:id`, e.g. `anilist:anime:16498`). Lists are keyed and de-duplicated by `media_key`; it will be the library's primary key in S2. `ProviderId::Manual` marks user-created entries: their key is `manual:<type>:<uuid>`, made in Rust, and the detail page never asks a provider for one (a UUID id is enough to tell), it draws the saved snapshot instead.

### Logging

`tauri-plugin-log` writes Rust logs to the terminal, a rotating file in the app log dir and logcat on Android; the level comes from `TAURI_APP_LOG`. Frontend `console.*` shows in devtools and is forwarded to the same sinks (`src/lib/logging/console.ts`). Provider errors and logs never include request URLs, so keys never leak.

## SPA configuration

Tauri has no Node server, so the frontend is a static bundle loaded from disk.

1. `svelte.config.js` uses `adapter-static({ fallback: "app.html" })`, so every route resolves to the same HTML file.
2. `src/routes/+layout.ts` sets `export const ssr = false`.
3. `vite.config.js` runs the dev server on port 1420 (`strictPort`), ignores `src-tauri/` in the watcher, and auto-injects `variables.scss`.

### Routes

```
/                    → Home (discover / search across 6 categories)
/media/[type]/[id]   → Detail (type = movie|tv|anime|manga|book|game)
/library /profile /planner /settings /welcome → local library, dashboard, planner, preferences and onboarding
```

Navigation happens on the client via `goto()` from `$app/navigation`.

## Data flow

### Home

`src/routes/+page.svelte` is a thin shell over `BrowseStore` (`src/lib/stores/browse.svelte.ts`) and `components/browse/*`.

```
CategoryTabs → browse.switchCategory(cat)
  → catalog.fetchGenres(cat) → one GenreCarousel per genre (idle)
    → whenVisible attachment (one screen ahead) → browse.loadSection(id)
      → catalog.fetchPage(cat, "", 1, genreId)
MultiSelect (Genres) → browse.setSelectedGenres(ids) → visibleSections (client-side filter, no request)
SearchField submit → browse.search(q) → catalog.fetchPage(cat, q, 1, null) → ResultsGrid
```

- Carousels load lazily and once (`loadSection` is idempotent; `retrySection` after an error).
- Results that resolve after a category or search switch are dropped.
- Grid mode has infinite scroll: an `IntersectionObserver` (`rootMargin: "300px"`) in `ResultsGrid` calls `browse.loadMore()`. A page with nothing new ends pagination.

### Detail

```
MediaCard click → goto(`/media/${type}/${encodeURIComponent(id)}`)
  → detail page reads params → catalog.fetchDetail(type, id)
    → Rust validates type/id → Provider::detail → MediaDetail
  → DetailHero, DetailMeta, TrailerEmbed, ScreenshotStrip, CastRow (components/detail/*)
```

## State

| Store | File | What it holds |
| --- | --- | --- |
| `BrowseStore` | `src/lib/stores/browse.svelte.ts` | Home: category, query, grid items/paging, genre sections, selected genres. Takes a `Catalog` in its constructor so tests inject a fake. |
| `libraryFilters` | `src/lib/stores/libraryFilters.svelte.ts` | Library status, picked types (`types: MediaType[]`, empty = all) and search filters, kept for the session so they survive opening a card. |
| `motionStore` | `src/lib/stores/motion.svelte.ts` | `on`: may decorative motion run (the saved `motion` setting, overruled by the system's reduce-motion). `reduced`: the system asked for less motion. Every animating component reads this; none checks `matchMedia` itself. |
| `ambientStore` | `src/lib/stores/ambient.svelte.ts` | `away`: the document is hidden or the window unfocused. `AppBackground` owns the listeners (`watch()`); `+layout` writes `<html data-ambient>`; every ambient loop pauses on it. |

### Merged items (`library.json` v2)

`library.json` is `{ schema_version: 2, entries, merged }`. `merged` maps each manual key that was matched to the catalog to a `Tombstone { into, entry, existing, at }`: the catalog key it became, the manual entry as it was, and the catalog entry before a combine (`null` if there was none). It is written in the same atomic save as the entries, so Undo and the XP link survive a failed event write. v1 files upgrade on load (`add_merged` in `MIGRATIONS`); an older app refuses a v2 file and asks to update. Backups carry `merged`: a merge import never brings back a manual item that was merged here, adds the backup's merges except for a manual key still saved here, and refuses a backup whose merge record names a non-manual key or one that is also a saved entry.

## Background system

| Layer | z-index | Source |
| --- | --- | --- |
| Bubbles + radial glows (`.bg-layer`) | 0 | `AppBackground.svelte` (CSS keyframes, 20 `<li>`) |
| Vignette | 1 (inside `.bg-layer`) | `AppBackground.svelte` |
| Page content | 1 | `.app-content` in `+layout.svelte` |
| Film grain | 4 | `body::before` in `global.css` (`pointer-events: none`) |

## Build pipeline

- Dev: `npm run tauri dev` starts Vite on `:1420` and opens the WebView against it. Changes to `src-tauri/` trigger a Rust rebuild.
- Prod: `npm run tauri build` runs `npm run build` (static SPA into `build/`), then compiles the Rust binary with the frontend embedded, then bundles.
- Windows builds from WSL: see [BUILD_AND_RUN.md](../BUILD_AND_RUN.md) (`./scripts/wdev.sh`, `./scripts/wdev.sh build`).
- Gate: `npm run verify` (see `AGENTS.md`).

## Security notes

- `src-tauri/tauri.conf.json` defines production and development CSP directives, including provider image and IPC origins.
- Capabilities: `core:default`, `opener:default`, `log:default` (`src-tauri/capabilities/default.json`).
- `.env` is gitignored; debug binaries can embed keys and must not be shared. Release binaries explicitly blank both compiled provider keys. Users save their keys locally in `keys.json`; backups omit them.
