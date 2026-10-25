# Changelog

All notable changes to Aevum are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).
Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Matching a manual item to the catalog: the matched item's data wins (AniList's 25 episodes over a typed 300). Your item's numbers and details (year, author, overview, genres, platforms, poster) only fill what the catalog leaves empty; when combining with a saved catalog item, the order is catalog → saved item → yours. Progress past the new length stops at its end and the item is marked Completed, instead of the match being refused. The compare step now shows yours → the catalog's and lists only what changes (old struck through, new in bold), with what stays on one line. Each side shows its title, length and type · year under its label; a length the catalog replaces is struck through (~~666 chapters~~ **189 chapters**).
- Renamed from the `tauri-app` placeholder to **Aevum** (Latin: an age, a lifetime); bundle identifier `com.user.tauri-app` → `com.rafaelsm993.aevum`. The Android project was regenerated for the new package; a device with the old debug APK must reinstall.

### Added
- One session picker for the Plan and Log session sheets: `‹ [centre] ›` with a quiet **Custom** that types minutes straight into the centre and shows what they are worth in units and time ("6 chapters · 2 h", "≈ 3 chapters · 50 min", "≈ 25 pages · 50 min"). TV, anime and manga step by whole episodes or chapters (never below one, at most 12 h or what is left); books and games step by 30 min, floor 30 min unless the item or what is left is shorter; movies keep their presets in Plan and log as one "Full movie". Existing plans open on their whole steps, or on Custom with their exact minutes.
- Log session from a Library card or Home's Continue row: it opens on today's planned session without raising the phone keyboard, shows what it adds and what is left (in hours), rounds to whole units by itself, starts a planned item and finishes it on its last unit. Today's sessions lead Continue (the separate Today strip is gone); the cover icon plans an item.
- Plans start at one full movie, episode or chapter; a new plan fills a missing episode length from the catalog (TMDB/AniList `runtime`, never a single episode's), says where it came from, and marks the length fields it needs as **Required**. When the catalog has no length, the detail page and the Plan sheet say so and why it matters, with an "Add length" button on the detail page.
- Settings: reading pace (pages per hour) and a default minutes per manga chapter, both prefilled in the Plan sheet.
- One-tap common episode lengths when adding an item (TV 22/30/45/60, anime 12/24 min), on one row on a phone.
- Edit an item's length any time; a hand-made item's length and **type** can change from its form (its history and XP follow it; progress restarts in the new type's units, the plan goes).
- One sticky app header (search and filters), which collapses on scroll down and returns on scroll up; all six Home categories fit a phone without a sideways swipe.
- Library filters fit one row: a **Filters** button (its badge counts what is on) opens Status and Type as a bottom sheet on a phone or a popover on desktop, applied at once, with Reset. The chosen status shows as a removable token, and the types scroll as chips with counts; picking one leaves only its chip, and its ✕ brings the rest back. Options with nothing in them are greyed out. On a phone the Library header went from 436 to 240 px.
- Backup: export the library, activity, posters and settings to one zip from Settings, and import it back by merging or replacing (a safety copy is saved before a replace). API keys are never exported. Works on Android too, with files chosen in the system picker (the backup is verified before it is copied into the chosen file).
- Profile: level, title, XP and streak, derived from the activity log (titles by level; values are placeholders until a playtest).
- Profile dashboard: level ring, stat tiles, XP progression by family (30 days / 90 days / all), activity heatmap, library donut, taste radar and a forecast (backlog hours, next-level ETA, projected XP), built on LayerChart with the app's color tokens; every chart has a text summary and a table for screen readers.
- Level-up moment: crossing a level shows a toast anywhere in the app ("Level 3 · New title: Curious Mind", hides after 6 s) and a one-off burst on the profile ring (skipped when motion is off, following the setting and the system live); each level is celebrated once (`seen_level` in the settings file, never lowered outside an import; a failed save does not repeat the toast), and existing progress or an import is adopted silently. The toast sits above the back-to-top button and the offline notice.
- The profile menu shows your level, title and a progress bar to the next level on every page.
- A readable screen when saved data cannot be opened (a file from a newer version, or an unreadable one) instead of the app not starting; the file is left untouched.
- Six media categories: movies/TV (TMDB), anime/manga (AniList GraphQL), games (RAWG), and books (iTunes)
- Shared `MediaItem`/`MediaDetail` mappings across providers
- Search, genre filtering, and per-genre discovery carousels
- Media details at `/media/[type]/[id]`, with cast, trailers, and provider-specific metadata/screenshots when available
- Infinite scroll with IntersectionObserver
- Netflix-style MediaCard with poster, rating, hover overlay
- CSS-animated floating background shapes, radial glows, and vignette
- Netflix-style SCSS/CSS design tokens, with SCSS variables and mixins auto-injected by Vite
- Svelte 5 runes and class-based application stores

### Fixed
- The Genres panel's Clear on Home is no longer hidden under Android's navigation bar: popovers end above it.
- The session picker no longer shows "NaN" when Custom's minutes are emptied in the Plan and Log session sheets; it says the shortest session instead, and "At most 12 h." past the limit.
- An accent's own text colour (Ember's dark text) now reaches every filled button, in the dark, light and system themes.
- The length and Log session sheets no longer open the phone keyboard over their own buttons.
- An open toast (today's reminder, a level-up) no longer covers the end of a page: the page can scroll its last cards above it.
- Taps reach cards showing through the collapsed header's gap; the header pins below the Android status bar.

### Removed
- The level chip in the page header (the level lives on the Profile tab) and Home's Today strip.
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
