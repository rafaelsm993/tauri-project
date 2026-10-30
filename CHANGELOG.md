# Changelog

All notable changes to SESH (formerly Aevum) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).
Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Release builds (including personal Windows, Android and Linux Flatpak builds) omit compiled TMDB/RAWG keys even when `.env` or build-environment values are set. Enter keys locally in Settings → Keys; debug builds can still embed keys and must not be shared. The signed Android release is copied to `SESH.apk`; Linux has a local x86_64 Flatpak build.
- **Renamed to SESH** (was Aevum). The app id is now `com.rafaelsm993.sesh`, so data lives in a new folder: on Windows copy `%APPDATA%\com.rafaelsm993.aevum` to `%APPDATA%\com.rafaelsm993.sesh` before the first launch; on Linux copy `~/.local/share/com.rafaelsm993.aevum` to `~/.local/share/com.rafaelsm993.sesh`; on Android, export a backup in Aevum and import it in SESH (it installs as a separate app). The level-50 title is now "SESH Eternal"; a saved "Aevum Eternal" carries over.
- Runic shimmer now plays as a living constellation: starlight runs along the Journey Tree's paths, seals twinkle in a wave and a starfield breathes behind them; it runs while the window is focused and pauses with the background.
- Library's Type filter picks several media types at once; every chip stays visible and each picked type has its own ✕.
- On desktop, Home's category pill is centred and sized to its tabs.
- On desktop, Settings is one centred column and has no Back button (the rail's Settings tab is always there).
- Theme and background picker labels sit above their previews; Avatar and Title keep their existing layouts.
- Android backgrounds use display-synchronized canvas rendering targeting 30 fps, replacing the visibly choppy 8-fps candidate; desktop retains its CSS motifs. Motion-off, reduced motion, hidden and unfocused windows suspend decoration.
- Settings offers only earned Avatar images; locked previews remain in Journey Tree. Profile centers the avatar in the shared navigation XP ring, stacks title/current level below it, and removes Activity.
- Welcome uses inert app-component illustrations and more safe-top spacing. Tracking choices and taste-based Home startup are removed; legacy saved resume indexes and settings remain compatible.
- Welcome explains the Journey Tree, planning versus logging, book/page and manga/chapter paces, and manual matching. New teaching beats append without changing existing saved indexes. Key CTAs reflect saved providers and drafts, validating pending keys before advancing and retaining failed drafts.
- Create/edit plans keep all seven compact weekday pills on one row: tap or swipe across to paint selections, start on a selected day to clear, with full accessible names, keyboard access and rollback on touch cancellation; only Save persists.
- Mobile navigation fills the selected icon-and-label item with the equipped accent and paired foreground, preserving Profile artwork/ring and the desktop rail; Dusk and Ocean now use dark foregrounds for small filled-label contrast.
- Settings opens Profile first with artwork, title and Backup together, followed by Theme and Preferences; sections remain independently expandable.
- Library, Planner, Profile and Settings headers now scroll with their pages instead of sticking over the content. Home retains its sticky search and cohesive category collapse.
- Search headers fill the available width without an opaque surrounding rectangle. Home and Library filters sit inside the search field and fill with the equipped accent when active; tags fade and slide together on scroll, including slow scroll gestures. Library search keeps an opaque themed surface so covers and text cannot bleed through it.
- Compact Settings into Theme, Profile, Preferences and Backup accordions with current-selection preview dropdowns; retain reward eligibility and existing preference, backup and API-key workflows.
- Library’s tree is now **JOURNEY TREE**, under THE SHARED ROOT: six media paths with connected reward seals. Existing themes, accents, backgrounds and titles each have one subtree home; tap any locked or available seal to preview what it unlocks and its required level. Global rewards remain level-only, artwork retains its level/completion gates, and Settings still handles equipment. Unlock rules and saved-data formats are unchanged.
- Equipment (accent, theme, title and profile artwork) is chosen in Settings now; the Profile's old Achievements section is gone. Each reward lists the level it needs, and a locked reward still shows its palette or crest without being equippable.
- A reward's eligibility follows your **current** level and completed counts, not the highest level you have ever seen: stop meeting a requirement and its reward, title or artwork falls back to Default, then returns by itself the moment it is earned again. `seen_level` only stops a level-up toast from repeating.
- An item's status follows its progress: 0 is Planning, partway is In progress, the last unit is Completed (lowering it un-completes; a movie is Completed when marked Watched). Adding still saves as Planning and logging sessions moves it the same way. The detail page's status chips are gone: on a phone they cut off Completed and Dropped.
- The detail page's progress card: a big "87 / 232 chapters" count, a status badge, − / + and Edit length, and a pixel-art boss health bar in the equipped accent that you drag or tap to jump; its empty side has diagonal stripes that scroll only while Animations is on. Rating is five pixel-art stars (after Terraria's Fallen Star) in the equipped accent, a point per half star: tap one, swipe across them, or use the keys; tap the current value again to clear it; centred, with the word under them ("8 · Great"); a pixel pop, square sparks and a twinkle play on a raise when Animations is on.
- Plan / Edit plan, Log session, Drop / Resume and Remove sit in one icon bar at the bottom of the detail page (fixed above the tab bar on a phone). Resume returns a dropped item to what its progress says; Plan and Log session wait while it is dropped, and Log session needs a plan.
- Matching a manual item to the catalog: the matched item's data wins (AniList's 25 episodes over a typed 300). Your item's numbers and details (year, author, overview, genres, platforms, poster) only fill what the catalog leaves empty; when combining with a saved catalog item, the order is catalog → saved item → yours. Progress past the new length stops at its end and the item is marked Completed, instead of the match being refused. The compare step now shows yours → the catalog's and lists only what changes (old struck through, new in bold), with what stays on one line. Each side shows its title, length and type · year under its label; a length the catalog replaces is struck through (~~666 chapters~~ **189 chapters**).
- Renamed from the `tauri-app` placeholder to **Aevum** (Latin: an age, a lifetime); bundle identifier `com.user.tauri-app` → `com.rafaelsm993.aevum`. The Android project was regenerated for the new package; a device with the old debug APK must reinstall.

### Added
- Profile artwork: 30 original pixel crests — movies, TV, anime, manga, books and games, five tiers each at 1 / 5 / 10 / 25 / 50 completed — recoloured by the equipped accent, previewed and equipped from Settings. The equipped crest replaces the Profile glyph in the bottom navigation and sits beside the level ring on the Profile card; a saved crest that stops being earned falls back to Default and returns automatically when re-earned.
- Titles you have earned are selectable from Settings ("Automatic" keeps the level's own title); each locked title lists the level it needs.
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
- Swiping across the plan's weekdays no longer makes the row jump under the finger when the summary below rewraps; on the Linux app the swipe also no longer stops painting after the first day.
- On touch screens, sheets no longer show a classic scrollbar that narrowed the weekday buttons below the 44 px touch size (Linux app).
- Settings has an in-app Back action using navigation history, with Profile as its cold-entry fallback.
- Runic shimmer briefly reveals visible tree channels, roots and crown on each map entry, then settles; it no longer animates only hidden art or shakes continuously.
- Returning Home restores scroll immediately, without smooth scrolling or late carousel layout shifts overriding the restored position.
- Journey Tree nodes and disclosures clear sticky headers when scrolled into view, and Back restores the originating crest or achievement focus.
- Large libraries hydrate in one reactive update, preventing the Profile crash with thousands of saved entries.
- Default primary buttons use white text on the unchanged fill, meeting small-text contrast in dark and light themes.
- The Genres panel's Clear on Home is no longer hidden under Android's navigation bar: popovers end above it.
- The session picker no longer shows "NaN" when Custom's minutes are emptied in the Plan and Log session sheets; it says the shortest session instead, and "At most 12 h." past the limit.
- An accent's own text colour (Ember's dark text) now reaches every filled button, in the dark, light and system themes.
- The length and Log session sheets no longer open the phone keyboard over their own buttons.
- An open toast (today's reminder, a level-up) no longer covers the end of a page: the page can scroll its last cards above it.
- Taps reach cards showing through the collapsed header's gap; the header pins below the Android status bar.

### Removed
- The separate earlier/current/later level-rewards ladder and the tree on Profile; Profile keeps its dashboard, graphs, level card and equipped artwork.
- The Profile's Achievements section (its cosmetic rewards, titles and artwork now live in Settings).
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
- The Linux Flatpak has passed a first-launch Welcome smoke on a desktop; full Linux offline, backup and small-window checks, Windows installer runtime, and Android release light-theme system bars still need checks.
- iTunes book ratings stay on Apple's 0–5 scale; other providers are normalised to 0–10

## [0.1.0] - unreleased
- Initial project scaffold (Tauri 2 + SvelteKit + Rust)
