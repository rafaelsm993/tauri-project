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
- While loading it shows 8 skeleton cards. Errors and empty results render inline; with `onRetry` the error has a "Try again" button (home wires it to `browse.retrySection`).
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

## BackToTop and RoutePlaceholder

- `src/lib/components/ui/BackToTop.svelte`: `threshold?`, `label = "Back to top"`; appears after scrolling past the threshold.
- `src/lib/components/ui/RoutePlaceholder.svelte`: `title`; the body of `/library`, `/profile`, `/planner` and `/welcome` until their sprints.

## SearchBar

- File: `src/lib/components/ui/SearchBar.svelte`
- Props: `placeholder?: string`, `onSearch?: (q: string) => void`

A `<form>` with a search icon, a clear (×) button and focus glow.

- Submitting calls `onSearch(query.trim())`.
- The spinner (1.5s) and success pulse (2s) that follow run on **fixed timers**. They are not tied to the real request.
- Clear only empties the input. It does not call `onSearch`, so the parent keeps the previous results. The home page's "← Discover" link is what actually resets search.

## AppBackground

- File: `src/lib/components/ui/AppBackground.svelte`
- Props: none. Rendered once in `+layout.svelte`.

A fixed, `aria-hidden` decorative layer with three parts:

1. `.bg-area`: base colour plus radial glows.
2. `.circles`: 20 `<li>` bubbles animated with CSS `@keyframes`.
3. `.bg-vignette`.

An `$effect` watches `ui.lastClick` and adds `.pulsing` for 900ms. Nothing currently sets `lastClick`, so the pulse never fires in practice. No JavaScript animation loop runs. Colors come from the `--clr-*-rgb` channel tokens.

---

## Pages

The routes themselves are described in [SvelteKit Special Pages](Front-end/SvelteKit%20Special%20Pages.md).

## Layout (`src/routes/+layout.svelte`)

```svelte
<AppBackground />          <!-- fixed, z-index 0 -->
<div class="app-content">  <!-- z-index 1 -->
  {@render children()}
</div>
```

The layout imports `$lib/styles/global.css`. It has no nav bar and no route guard.
