# Aevum — SvelteKit Special Pages

> SvelteKit file conventions and the routes in the app.

## File conventions

| File | Role | Present |
| --- | --- | --- |
| `+page.svelte` | Page component for a route | `/`, `/media/[type]/[id]`, `/library`, `/profile`, `/planner`, `/welcome` |
| `+layout.svelte` | Wraps all child pages | `src/routes/+layout.svelte` |
| `+layout.ts` | Layout options/load; sets `ssr = false` | `src/routes/+layout.ts` |
| `+error.svelte` | Error boundary | not present (SvelteKit default) |
| `+page.server.ts` / `+server.ts` | Server-only code | never — there is no server |

The `+` prefix marks a file SvelteKit treats specially. Plain components and modules live in `src/lib/`.

## SPA mode (`+layout.ts`)

```typescript
export const ssr = false;
```

Tauri loads a static bundle from disk, so there is no Node server to render pages. Setting `ssr = false` together with `adapter-static({ fallback: "app.html" })` makes SvelteKit a client-only SPA.

## Root layout (`+layout.svelte`)

The root layout does three things: it imports `global.css`, renders `<AppBackground />`, and wraps the page in `<div class="app-content">`. It has no nav, no auth check and no redirects.

---

## Home (`/`) — `src/routes/+page.svelte`

A thin shell: all state lives in `BrowseStore` (`src/lib/stores/browse.svelte.ts`); the page wires it to components.

```
┌──────────────────────────────────────────────┐
│  SearchBar                                   │
│  CategoryTabs (scrolls)          [Genres ▾]  │
├──────────────────────────────────────────────┤
│  BrowseContext (← Discover / ← All genres)   │
│  GenreCarousel × one per genre (lazy)        │
│   — or —                                     │
│  ResultsGrid + infinite-scroll sentinel      │
└──────────────────────────────────────────────┘
```

Single column at every width; the genre `MultiSelect` sits in the tab bar's `trailing` slot and only shows in carousel mode.

### Modes

`carouselMode = !isSearch && activeGenre === null`

| Mode | Trigger | Shows |
| --- | --- | --- |
| Carousel | default | One `GenreCarousel` per genre (no cap), filtered client-side by the Genres multi-select |
| Grid | search query | `ResultsGrid` with infinite scroll; genre cleared |
| Grid | "See all →" on a carousel | `ResultsGrid` for that genre |
| Grid (fallback) | category has no genres | `loadGrid("")` |

### Data flow

1. `onMount` calls `browse.refreshView()`. In carousel mode that fetches the genres (`catalog.fetchGenres`) and creates one idle section per genre.
2. Each carousel slot has a `whenVisible` attachment (`rootMargin: "100% 0px"`, about one screen ahead) that calls `browse.loadSection(id)` once. A failed section shows "Try again" (`retrySection`).
3. `switchCategory(cat)` resets the genre and the selection (genre ids differ between providers) and refreshes.
4. `search(q)` clears the genre and loads the grid; `clearSearch()` ("← Discover") goes back to carousels.
5. In grid mode, `ResultsGrid`'s `IntersectionObserver` (300px margin) calls `loadMore()`. Items are de-duplicated by `media_key`; a page with nothing new ends pagination; results that arrive after a switch are dropped.
6. All requests go through `catalog.fetchPage(cat, query, page, genre)`; the provider-specific rules (TMDB search ignores the genre, iTunes is one page, empty book search means "fiction") live in Rust.

### Genre cache

`BrowseStore` keeps each category's genre list in a private, non-reactive `#genreCache` for the page's lifetime, so switching back to a tab needs no new request. Book genres come from Rust with no provider request.

---

## Detail (`/media/[type]/[id]`) — `src/routes/media/[type]/[id]/+page.svelte`

The params come from `page` in `$app/stores`. An `$effect` runs `fetchDetail(type, id)` whenever they change, which calls `catalog.fetchDetail(type, id)`. Rust validates the params: an unknown type shows "Invalid media type." and a non-numeric id for a numeric provider shows "Invalid ID.".

### Sections

| Section | Component / notes |
| --- | --- |
| Loading | `DetailSkeleton` |
| Error | Message + "Try again" + "← Back" |
| Hero | `DetailHero`: backdrop, fade, "← Back" (`goto('/')`), title, tagline |
| Poster | `poster_path`, or a "No poster" placeholder |
| Meta | `DetailMeta`: rating, year, runtime, episodes/chapters/volumes, status, platforms, credits line, genre pills |
| Overview | `detail.overview` |
| Trailer | `TrailerEmbed` (YouTube `<iframe>`): first `type === "Trailer"`, otherwise the first video |
| Screenshots | `ScreenshotStrip` (games) |
| Cast | `CastRow`: drag-to-scroll; initials when there is no photo |

Titled sections use `DetailSection`. The page sets `ui.detailMode = true` on creation and resets it in `onDestroy`.

---

## Placeholder routes

`/library`, `/profile`, `/planner` and `/welcome` each render `RoutePlaceholder` with a title. They exist so later sprints add screens as new routes instead of growing the two big pages. They are reachable by URL only (no nav yet).
