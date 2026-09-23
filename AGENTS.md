# tauri-app — Agent & Contributor Guide

Tauri 2 desktop app. SvelteKit SPA (Svelte 5 runes, TypeScript strict) talks to a
stateless Rust proxy over IPC. Providers: TMDB (movie/tv), AniList (anime/manga),
RAWG (games), iTunes (books). No persistence yet (S2 adds local JSON storage); no accounts, no cloud.

## Map
| What | Where |
|---|---|
| IPC facade (the only commands: `catalog_genres/page/detail`) | `src-tauri/src/api/catalog.rs` |
| Providers (`impl Provider`: raw serde structs → pure `map_*`) | `src-tauri/src/api/<provider>.rs` |
| Shared DTOs | `src-tauri/src/api/types.rs` |
| Shared HTTP client | `src-tauri/src/api/http.rs` (`use super::http::client as http;`) |
| Command registration | `src-tauri/src/lib.rs` → `generate_handler![]` |
| Permissions / capabilities | `src-tauri/capabilities/*.json` |
| IPC client | `src/lib/api/catalog.ts` (3 typed `invoke`s, no mapping) |
| Shared types (mirror of `types.rs`, guarded by `media.contract.test.ts`) | `src/lib/types/media.ts` |
| Components | `src/lib/components/{media,ui}/*.svelte` |
| Stores | `src/lib/stores/*.svelte.ts` (class + `$state`, singleton) |
| Styles | `src/lib/styles/` — SCSS vars/mixins auto-injected; never `@use`/`@import` in components |

## The gate — nothing is "done" until this is green
```bash
npm run verify   # prettier + eslint + breakpoint/english/colors lint + docs guards + svelte-check + vitest + playwright (5 viewports) + cargo fmt/clippy(-D warnings)/test
```
Fast loops: `npm run test:watch`, `npx playwright test --project=phone-small`, `cd src-tauri && cargo test <name>`, `npm run check`.

## Workflow for every feature / fix
1. **Intake** — restate the goal in one sentence; list files you'll touch (read them first).
2. **Plan** — for >3 files, write `.hermes/plans/<date>-<slug>.md` and get a yes.
3. **RED** — write the failing test first (Rust `#[cfg(test)]` next to the code; TS `*.test.ts` next to the file). Run it; see it fail for the right reason.
4. **GREEN** — minimal code to pass.
5. **Refactor** — remove duplication, name things, keep functions small. Tests stay green.
6. **Verify** — `npm run verify` exit 0. For UI changes also `npm run tauri dev` and look at it at full size **and** dragged down to the 360 px minimum.
7. **Handoff** — summary: what changed, gate output tail, anything not verified.
Commits/branches only with the user's explicit OK. Conventional Commits (`feat(scope): …`).

## Tauri 2 CLI — use it, don't hand-roll
| Need | Command |
|---|---|
| Environment report (paste into bug reports) | `npm run tauri info` |
| Dev app | `npm run tauri dev` |
| Add an official plugin (Cargo + npm + capability in one go) | `npm run tauri add <plugin>` |
| List / create permissions | `npm run tauri permission ls` · `npm run tauri permission new` |
| Create a capability | `npm run tauri capability new` |
| Regenerate app icons | `npm run tauri icon <src.png>` |
| Release build (only when asked) | `npm run tauri build` |
Never edit `src-tauri/gen/` by hand.

## Rust conventions
- Commands are thin: parse args → call a **pure helper** → shape JSON. Put logic in pure fns and unit-test those (see `rawg::total_pages`).
- Use the shared `http()` client; never `Client::new()` per call.
- Run independent requests concurrently with `tokio::join!` (see `rawg_details`).
- No `unwrap()`/`expect()` in command paths; propagate with `?` + `map_err`.
- New commands: prefer a typed `Serialize` struct over `serde_json::Value` when the frontend shape is fixed.
- Least privilege: a new plugin/command gets only the permissions it needs in `capabilities/`.
- Secrets: `TMDB_API_KEY`/`RAWG_API_KEY` come from `.env` via `build.rs`; never hardcode.
- Comments: English, one short line above a fn/type/const, only when the name doesn't say it. No banners, blocks, inline or in-body comments.

## Frontend conventions
- Svelte 5 only: `$props`, `$state`, `$derived`, `$effect`; `onclick` not `on:click`; no `writable()`.
- Prefer `$derived` over `$effect`; `$effect` is for side effects only (DOM, IPC), never to sync state.
- Keyed `{#each list as x (x.id)}` always.
- Components never call `invoke` directly — go through `src/lib/api/*`.
- Every provider maps to the shared types; the UI stays provider-agnostic.
- Accessible by default: real `<button type="button">`, `aria-*` state, labelled nav.
- Test UI with `@testing-library/svelte` by role/name; mock IPC with `@tauri-apps/api/mocks` (`mockIPC`, `clearMocks`).
- Colors come only from runtime tokens in `global.css`: `var(--clr-*)`, and alpha via channels `rgb(var(--clr-*-rgb) / 0.12)`. No hex, numeric `rgb()`, or SCSS color functions in components; `npm run lint:colors` enforces it (opt out per line with `// colors: allow`). A theme is a set of `--clr-*-rgb` overrides. No new colors without a token.
- Non-color design tokens stay SCSS: `$spacing-*`, `$radius-*`, `$font-*`, `$dur-*`.
- Formatting: Prettier owns it — double quotes in `.ts` **and** `.svelte`, 100 cols, trailing commas. Never hand-format; run `npm run format`.
- Comments: English, one short line above a function/const/prop, only when the name doesn't say it; no banners, blocks, inline or `<!-- -->` labels. CSS comments are exempt.
- English only (UI, fixtures, provider params). `npm run lint:en` enforces it; opt out per line with `// english-only: allow`.

## Responsive — every component, every time
Supported range: **360 px phone → 1920 px+ desktop**, mouse **and** touch. The desktop window's minimum is 360×560 (`tauri.conf.json`), so small layouts are reachable on desktop too.
- **Design the smallest layout first**, then add room. Every new component must look right at 360, 768, 1280, and 1920.
- **Breakpoints:** only `@include respond-to(sm|md|lg|xl|2xl)` (desktop-first, `max-width`). Raw px inside `@media` fails `npm run lint:bp`. Need a new width? Add a `$bp-*` token.
- **Input, not width:** use `@include touch` / `@include hover-capable` for hover effects and target size. A 1280 px touchscreen exists; a 400 px mouse window exists.
- **No hover-only content.** Anything revealed on `:hover` must also be visible under `@include touch` and on `:focus-visible`.
- **Touch targets:** ≥ `$touch-target` (44 px) under `@include touch`.
- **Fluid over fixed:** `clamp()`, `min()`, `minmax(0, 1fr)`, `flex-wrap`, `min-width: 0` on flex/grid children. No fixed widths above 160 px without a `max-width: 100%`.
- **Never** hide overflow on `html`/`body` to "fix" a layout; find the wide element instead.
- **Rails/tabs** that can exceed the width must scroll horizontally (`overflow-x: auto`), not wrap into a broken grid or get clipped.
- **Tests:** a new screen gets an entry in `SCREENS` in `e2e/responsive.spec.ts`. A new interactive component gets a touch-target or visibility assertion there if it has hover or small controls. IPC is faked in `e2e/fixtures/tauri-ipc.ts`; add fixtures for new commands.
- Mobile builds (`tauri android|ios`) aren't initialised yet. Keep Rust free of desktop-only APIs outside `#[cfg(desktop)]` so enabling them later is config, not a rewrite.

## Adding a provider (checklist)
Save real responses to `src-tauri/tests/fixtures/` (strip keys/URLs) → module with `Raw*` structs + pure `map_*` fns tested on them → `impl Provider` → arms in the 3 `catalog.rs` matches → `mod.rs` → e2e fixture if the home tab changes → `cargo test live_ -- --ignored` → `npm run verify`.
Changing a DTO: edit `types.rs`, run `UPDATE_CONTRACT=1 cargo test contract`, mirror `media.ts` until `media.contract.test.ts` is green.
