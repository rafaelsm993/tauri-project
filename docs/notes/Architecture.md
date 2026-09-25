# Aevum — Architecture

> Tauri 2 app: a SvelteKit SPA that calls a typed Rust facade, which fetches from four public media APIs and returns shared DTOs.

## Overview

**Name.** *Aevum* is Latin for an age or a lifetime — in scholastic use, the time
angels inhabit, between mortal hours and eternity. It fits an app whose subject is
the hours you spend on stories and games. Locked 2026-09-24 with the identifier
`com.rafaelsm993.aevum` (vault `GOALS-QA.md` §6.15).

Aevum lets you browse movies, TV series, anime, manga, books and games. Today it has two real screens, **Home** (discovery and search) and **Detail**, plus placeholder routes for the library, profile, planner and welcome flow. There are no accounts and no cloud. There is no persistence yet: S2 adds local JSON storage in the app data dir.

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
- Data comes only from `src/lib/api/catalog.ts` (three typed `invoke()`s). The app never calls `fetch()` and does no provider mapping.
- UI is English only; `npm run lint:en` enforces it.

### Backend — Rust / Tauri 2

- Tauri 2 with `tauri-plugin-opener` and `tauri-plugin-log`.
- `reqwest` 0.12 with `rustls-tls` (no OpenSSL) on Tokio, through one shared client (`src-tauri/src/api/http.rs`).
- Three commands in `src-tauri/src/api/catalog.rs` dispatch to a common `Provider` trait (`genres · page · detail`) implemented per provider. Each provider parses into private `Raw*` structs and maps them with pure `map_*` functions into the DTOs in `src-tauri/src/api/types.rs`. See [API Reference](API%20Reference.md).
- A Rust test writes `src/lib/types/contract.fixture.json`; `media.contract.test.ts` keeps `media.ts` in sync with the Rust DTOs.
- No managed state yet.
- API keys: `TMDB_API_KEY` and `RAWG_API_KEY` are read from `.env` at compile time by `build.rs`; a runtime env var overrides them. (S2·B5 moves keys to runtime settings.)

### Identity

Every item carries `provider` and `media_key` (`provider:media_type:id`, e.g. `anilist:anime:16498`). Lists are keyed and de-duplicated by `media_key`; it will be the library's primary key in S2. `ProviderId::Manual` is reserved for user-created entries.

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
/library /profile /planner /welcome → placeholders (RoutePlaceholder), filled from S3 on
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
SearchBar submit → browse.search(q) → catalog.fetchPage(cat, q, 1, null) → ResultsGrid
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
| `ui` | `src/lib/stores/ui.svelte.ts` | `detailMode` (detail-page background), `lastClick` (read by `AppBackground` for the bubble pulse; nothing sets it). `activeHue`, `intensity`, `triggerClickPulse()`, `setHoverHue()` have no callers (leftovers from the removed canvas background). |

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

- CSP is `null` in `tauri.conf.json` for every build. It needs a decision before release (owned by S3·C6).
- Capabilities: `core:default`, `opener:default`, `log:default` (`src-tauri/capabilities/default.json`).
- API keys stay out of source (`.env` is gitignored), but they are embedded in the compiled binary. Anyone who inspects the binary can recover them, so treat them as public until S2·B5.
