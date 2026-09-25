# Changelog

All notable changes to Aevum are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).
Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Renamed from the `tauri-app` placeholder to **Aevum** (Latin: an age, a lifetime); bundle identifier `com.user.tauri-app` → `com.rafaelsm993.aevum`. The Android project was regenerated for the new package; a device with the old debug APK must reinstall.

### Added
- Six media categories: movies/TV (TMDB), anime/manga (AniList GraphQL), games (RAWG), and books (iTunes)
- Shared `MediaItem`/`MediaDetail` mappings across providers
- Search, genre filtering, and per-genre discovery carousels
- Media details at `/media/[type]/[id]`, with cast, trailers, and provider-specific metadata/screenshots when available
- Infinite scroll with IntersectionObserver
- Netflix-style MediaCard with poster, rating, hover overlay
- CSS-animated floating background shapes, radial glows, and vignette
- Netflix-style SCSS/CSS design tokens, with SCSS variables and mixins auto-injected by Vite
- Svelte 5 runes and class-based application stores

### Removed
- Local account system (register / login / profile switching) and its SQLite `users` table
- Watchlist feature, including the `watchlist` table, the `/watchlist` route, and the `WatchlistButton` component
- Optional cloud backend integration (`VITE_CLOUD_API_URL`, `src/lib/api/cloud.ts`)
- The unused `greet` Tauri command
- The `rusqlite` dependency — the backend is now a stateless API proxy

### Changed (S1 — stable base)
- Typed catalog facade: three IPC commands (`catalog_genres/page/detail`) over a common Rust `Provider` trait; providers map into typed DTOs, with a Rust↔TS contract test
- `media_key` identity (`provider:media_type:id`) on every item; lists keyed and de-duplicated by it
- Home and Detail split into thin routes, `BrowseStore` and components; genre multi-select with lazy per-genre carousels
- English-only UI and provider params (TMDB `en-US`, iTunes `country=us`)
- Runtime theming: every component color is a `--clr-*` token (`lint:colors` guard)
- Debug logging with `tauri-plugin-log` (terminal, log file, logcat), keys never logged
- MIT `LICENSE` file; docs and agent instructions updated to the new architecture

### Known issues
- CSP is `null` and devtools are enabled in every build (decision owned by S3·C6)
- API keys are compiled into the binary (runtime keys come with S2·B5)
- iTunes book ratings stay on Apple's 0–5 scale; other providers are normalised to 0–10

## [0.1.0] - unreleased
- Initial project scaffold (Tauri 2 + SvelteKit + Rust)
