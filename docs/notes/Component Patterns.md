# Aevum — Component Patterns

> Conventions for the reusable UI components, with a reference entry for each.

All components use Svelte 5 syntax:

- `<script lang="ts">` with `$props`, `$state`, `$derived`, `$effect`
- `<style lang="scss">`: variables and mixins are injected automatically, so never add `@use` or `@import`
- Event attributes (`onclick`, `onsubmit`, `onscroll`), not `on:click`
- Snippets: `{#snippet Name()}…{/snippet}` + `{@render Name()}`
- Callback props (`onchange`, `onSearch`, `onCardClick`) instead of dispatched events
- Colors only from `var(--clr-*)` / `rgb(var(--clr-*-rgb) / a)` (`npm run lint:colors`); visible text in English (`npm run lint:en`)
- Lists keyed by `item.media_key`
- Components never call `invoke`; data flows in through props from a store or route

---

## MediaCard

- File: `src/lib/components/media/MediaCard.svelte`
- Props: `item: MediaItem`, `onclick?: () => void`

A poster card rendered as a single `<button>`. It is used in both the grid and the carousels.

- 2:3 poster with `loading="lazy"` and a shimmer while it loads. The poster fades in `onload`.
- Falls back to an icon plus the title when there is no poster or the image fails to load.
- Hover overlay (`aria-hidden`) shows:
  - type badge (`MEDIA_LABELS`) and rating
  - title, author, overview
  - year, eps/chapters and rating count (formatted with `en-US`)
- A static label under the poster shows the title and year.
- Focus: `:focus-visible` draws a `var(--clr-primary)` outline on the poster.

## CategoryTabs

- File: `src/lib/components/ui/CategoryTabs.svelte`
- Props: `active: MediaType`, `onchange: (c: MediaType) => void`, `trailing?: Snippet`

A pill tab bar with a fixed list of categories: Movies, TV Shows, Anime, Manga, Books, Games. The parent owns the active state.

- The pill background sits on a `.category-bar` wrapper; only the inner `nav` scrolls horizontally, so it never wraps or clips at 360 px.
- `trailing` renders at the end of the bar, outside the `nav` landmark (not announced as a category). Home puts the genre `MultiSelect` there.

## GenreCarousel

- File: `src/lib/components/ui/GenreCarousel.svelte`

| Prop | Type | Required |
| --- | --- | --- |
| `title` | `string` | ✓ |
| `items` | `MediaItem[]` | ✓ |
| `loading` | `boolean` | — |
| `error` | `string` | — |
| `onCardClick` | `(item: MediaItem) => void` | ✓ |
| `onSeeMore` | `() => void` | — |
| `onRetry` | `() => void` | — |

A horizontally scrolling rail of `MediaCard`s with scroll-snap.

- Arrow buttons appear when `canScrollLeft` / `canScrollRight` are true. These are `$state` values updated `onscroll` and by an `$effect` after items load. Each click scrolls about 85% of the visible width.
- While loading it shows 8 `Skeleton` cards. An error replaces the rail with an `ErrorNote` (with `onRetry` it has a "Try again" button; home wires it to `browse.retrySection`); an empty result renders inline.
- The rail is a `list` only while it shows cards; skeletons, the error and the empty text are not list items.
- "See all →" appears when `onSeeMore` is passed. The home page wires it to `switchGenre(genre.id)`.
- Home mounts one carousel per genre and loads each one lazily with the `whenVisible` attachment (`src/lib/attachments/whenVisible.ts`).

## MultiSelect

- File: `src/lib/components/ui/MultiSelect.svelte`

| Prop | Type | Required |
| --- | --- | --- |
| `label` | `string` | ✓ |
| `options` | `{ value, label }[]` | ✓ |
| `selected` | `value[]` | ✓ |
| `onchange` | `(next: value[]) => void` | ✓ |
| `disabled` | `boolean` | — |

A button that opens a popover of native checkboxes. Generic: values keep their type and order.

- Trigger reads `Label · N` when something is selected.
- The panel uses `popover="auto"` (top layer), so the scrolling tab bar never clips it; Esc and an outside click close it. It is placed under the trigger, kept on screen, and re-placed on scroll/resize.
- Each row is a labelled checkbox stretched over the row; selected rows are filled with the primary color and bold. Rows are ≥ 44 px under `touch`.
- "Clear" empties the selection. Home uses it as the genre filter: it shows or hides carousels client-side, with no extra requests.

## ResultsGrid and BrowseContext

- Files: `src/lib/components/browse/ResultsGrid.svelte`, `src/lib/components/browse/BrowseContext.svelte`

`ResultsGrid` (`items`, `loading`, `appending`, `hasMore`, `hasError`, `onCardClick`, `onLoadMore`) is the search / single-genre grid with infinite scroll through an `IntersectionObserver` sentinel. `BrowseContext` (`isSearch`, `query`, `genreName`, `onClearSearch`, `onAllGenres`) is the heading above it with the "← Discover" and "← All genres" links.

## Detail components

- Folder: `src/lib/components/detail/`

`DetailHero` (title, tagline, backdrop, back button), `DetailMeta` (`detail: MediaDetail`), `DetailSection` (titled wrapper with a `children` snippet), `TrailerEmbed` (`videoKey`, `name`), `ScreenshotStrip` (`screenshots`), `CastRow` (`cast`), `DetailSkeleton`.

## ErrorNote and Skeleton

- `src/lib/components/ui/ErrorNote.svelte`: `message`, `onretry?`, `children?` (extra actions after the retry, e.g. the detail page's Back). A `role="alert"` box in the error colours; buttons are ≥ 44 px under `touch`. Every page-level and section-level error uses it: home grid, carousels, detail, library, profile, settings, backup. Errors inside a form (`SaveToLibrary`, `PlanDialog`) stay as plain text next to the fields.
- `src/lib/components/ui/Skeleton.svelte`: `poster?` (a 2:3 block), `heading?` (a title and a subtitle bar), `lines = 1`. Always `aria-hidden`, no inline styles; the shimmer stops under the system's reduce-motion. Used by `GenreCarousel`, `ResultsGrid` and `DetailSkeleton`.

## Sheet

- File: `src/lib/components/ui/Sheet.svelte`
- Props: `label`, `onclose()`, `children`

The one modal for add/edit forms: a native `<dialog>` opened with `showModal()`, centred, over a dimmed `::backdrop` (`--clr-shade-rgb`). Focus moves to its first field and returns to the opener when it unmounts. Escape, the system back gesture (`cancel`) and a click on the backdrop call `onclose`; the parent decides and unmounts it. While an on-screen keyboard is up it sits above it (`--sheet-covered`, from `visualViewport`), so Save stays reachable. Android's back button navigates the page instead of closing the sheet (W5). The form inside keeps its own card look. Used by `SaveToLibrary` (add / edit length) and `PlanDialog`. jsdom has no `showModal`, so `vitest-setup.ts` stubs it.

## BackToTop and RoutePlaceholder

- `src/lib/components/ui/BackToTop.svelte`: `threshold?`, `label = "Back to top"`; appears after scrolling past the threshold.
- `src/lib/components/ui/RoutePlaceholder.svelte`: `title`; the body of `/library`, `/profile`, `/planner` and `/welcome` until their sprints.

## SearchField

- File: `src/lib/components/ui/SearchField.svelte`
- Props: `label`, `value`, `onchange(value)`, `placeholder?`, `mode?: "instant" | "submit"` (default `instant`), `loading?`, `onsubmit?(query)`, `onclear?()`

One search input for the whole app; the parent owns `value`.

- `instant` (library filter): reports every keystroke; no landmark, no spinner.
- `submit` (home catalog): a `<form role="search">` the height of the app bar (`$bar-height`). Enter calls `onsubmit(value.trim())`, a blank value submits nothing. The spinner shows only while `loading` (the real request), and `aria-busy` follows it.
- In both modes the clear (×) button and Escape empty the field and call `onclear`; the clear button keeps focus in the input and is ≥ 44 px under `touch`. Home's `onclear` also drops the search results, like the "← Discover" link.

## AppBackground

- File: `src/lib/components/ui/AppBackground.svelte`
- Props: none. Rendered once in `+layout.svelte`.

A fixed, `aria-hidden` decorative layer with three parts:

1. `.bg-area`: base colour plus radial glows.
2. `.circles`: 20 `<li>` bubbles animated with CSS `@keyframes`.
3. `.bg-vignette`.

No JavaScript animation loop runs; the bubbles pause while the window is hidden or blurred, or when the Animations setting (`prefs.motion`) is off. Colors come from the `--clr-*-rgb` channel tokens.

---

## Pages

The routes themselves are described in [SvelteKit Special Pages](Front-end/SvelteKit%20Special%20Pages.md).

## Layout (`src/routes/+layout.svelte`)

```svelte
<AppBackground />          <!-- fixed, z-index 0 -->
<div class="app-shell">    <!-- padded by --nav-left / --nav-bottom -->
  <AppNav {section} {progress} />
  <div class="app-content">  <!-- z-index 1 -->
    <LevelChip />            <!-- desktop only -->
    {@render children()}
  </div>
</div>
```

The layout imports `$lib/styles/global.css`. It has no route guard; the startup-problem screen has no
navigation.

## Switch

- File: `src/lib/components/ui/Switch.svelte`
- Props: `label`, `hint?`, `checked`, `disabled?`, `motion?`, `onchange(checked)`

A `<button role="switch" aria-checked>` with its label and hint wired by `aria-labelledby` /
`aria-describedby`, so Space and Enter work natively. The track is 48×28; under touch an invisible
`::before` grows the hit area to 44 px. The thumb stops sliding when motion is off. Use it for
on/off settings; a choice between named options stays a `SegmentedControl`.

## Themes

`prefs.theme` is `system`, `dark` or `light`. `applyTheme` (`src/lib/theme.ts`) sets
`data-theme` and `color-scheme` on `<html>` and remembers the choice; `static/theme-boot.js`
paints it before the app loads. `global.css` holds the dark palette on `:root` and the light one
under `[data-theme="light"]` and, for `system`, under `prefers-color-scheme: light`.
`scripts/contrast.test.mjs` (in `lint:guards`) checks every text/surface pair in both palettes (4.5:1 for text,
3:1 for hints and accents). Text on a red fill uses `--clr-on-primary`; text over a poster scrim
uses `--clr-on-scrim-rgb`, which stays white in both themes. On Android, `applyTheme` also calls the
`AevumSystemBars` bridge from `MainActivity.kt` so the status and navigation bar icons turn dark on
the light theme.

## AppNav, LevelChip and LevelRing

- `ui/AppNav.svelte` — props `section` (from `sectionOf` in `domain/navigation.ts`) and optional
  `progress`. One `<nav aria-label="Main">` of links: a left rail (`$nav-rail-width`) with Settings
  pinned to its bottom on desktop; a bottom tab bar (`$nav-bar-height` + safe area) without
  Settings at `md` and below. The current tab has a filled pill and `aria-current="page"`.
- A detail page keeps the tab it was opened from (the layout remembers the last section); opened
  cold it belongs to Home. `/welcome` has no tab.
- `ui/LevelChip.svelte` — the level number in a progress ring, top right on desktop, links to
  /profile ("Level N · Title"). On phone the ring sits on the Profile tab instead, whose name
  becomes "Profile · Level N"; Settings is a link in the Profile header.
- `ui/LevelRing.svelte` — the decorative ring both use.
- Fixed overlays (OfflineBanner, BackToTop, toasts) add `var(--nav-bottom)` / `var(--nav-left)`,
  set on `:root` by the layout, so they stay clear of the navigation.
