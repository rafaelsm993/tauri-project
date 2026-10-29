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
- `trailing` renders at the end of the bar, outside the `nav` landmark (not announced as a category). Home instead puts the genre `MultiSelect` inside the search field through `SearchField.trailing`.

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

## Progress card and item actions

- Folder: `src/lib/components/library/`; status rule in `src/lib/domain/status.ts`; icon paths in `src/lib/components/ui/icons.ts`

`ProgressEditor` (`mediaType`, `progress`, `total`, `status`, `rating`, `onprogress`, `onrating`, `plannable?`, `onaddlength?`, `lengthNote?`) is the detail page's "Your progress" card: a big count, a status badge (`Status:` for screen readers), − / + (one unit; − stops at 0, + at the total) and Edit length, then the star rating. A movie gets one **Watched** toggle (`aria-pressed`) instead. The bar is pixel art drawn by `aria-hidden` spans (a 5×5 grid of `--px` cells: four edges, four stepped corner pixels, the meter in the centre cell with a one-pixel gap ring), with an invisible native `<input type="range">` on top that does the work: drag, tap to jump, arrows/Home/End. While dragging, the count follows the thumb and nothing is saved; the value is saved once, on `change`, and only if it differs. Without a known total there is no bar and + has no ceiling. Colours are tokens only: a faint `--clr-ink-rgb` frame (0.18, no glow), `--clr-accent` fill with an `--clr-on-primary-rgb` top band and an `--clr-shade-rgb` base, `--clr-accent-rgb` stripes on the empty side. The stripes and the stepped width change are declared only under `:root[data-motion="on"]`, so Animations off (or system reduce-motion) means none at all. `--px` is 4 px on a phone, 3 px above.

`StarRating` (`value`, `onchange`, `disabled?`) is one `role="slider"` (0–10, `aria-valuetext` from `ratingText`, e.g. "8 · Great"; "Not rated") over five stars, a point per half star (`domain/rating.ts`: `starFill`, `ratingAt`, `ratingKey`). Pointer capture with `touch-action: pan-y`: a sideways swipe rates and saves once on release, a vertical one still scrolls. A tap on the current value clears it; a drag that wanders back does not. Keys: arrows ±1, PageUp/PageDown ±2, Home 1, End 10, Delete/Backspace clear. A mouse hover previews. Laid out as a centred column: the stars, then the word under them (the card centres the whole field under its label). The sprite is `ui/pixelStar.ts` (a 15×15 mask → three unit-square paths: outline, body, glint; `crispEdges`, 2 css px per pixel), drawn empty (faint ink) and then lit, clipped to 15/8/0 columns. Lit stars follow the equipped accent: `--clr-accent` body, the accent mixed with `--clr-shade-rgb` for the edge, and `--glint` (the accent mixed into `--clr-glint-rgb`) for the glint and the twinkle. A raise remounts only the stars it lit (`{#key}`) to play a stepped pop, four square sparks and a plus-shaped twinkle, staggered 50 ms; all of it only under `:root[data-motion="on"]`.

The page saves `progressPatch(entry, progress, total)`: progress plus the status it implies (`statusForProgress`), unless the item is Dropped. Log session keeps using `logPreview`.

`ItemActions` (`entry`, `total`, `detail?`, `dueMinutes?`, `xpOf`, `library?`) is a `role="toolbar"` of four icon buttons with labels: Plan / Edit plan, Log session, Drop / Resume, Remove. It owns the Plan, Log session and Remove sheets. Resume sets `resumeStatus` (what the progress says). While Dropped, Plan and Log session are disabled; Log session is also disabled without a plan or once finished, with the reason as its description. `SaveToLibrary` is now only "+ Add to library" and the add / edit-length sheet.

## ErrorNote and Skeleton

- `src/lib/components/ui/ErrorNote.svelte`: `message`, `onretry?`, `children?` (extra actions after the retry, e.g. the detail page's Back). A `role="alert"` box in the error colours; buttons are ≥ 44 px under `touch`. Every page-level and section-level error uses it: home grid, carousels, detail, library, profile, settings, backup. Errors inside a form (`SaveToLibrary`, `PlanDialog`) stay as plain text next to the fields.
- `src/lib/components/ui/Skeleton.svelte`: `poster?` (a 2:3 block), `heading?` (a title and a subtitle bar), `lines = 1`. Always `aria-hidden`, no inline styles; the shimmer stops under the system's reduce-motion. Used by `GenreCarousel`, `ResultsGrid` and `DetailSkeleton`.

## Sheet

- File: `src/lib/components/ui/Sheet.svelte`
- Props: `label`, `onclose()`, `children`, `focus?: "field" | "sheet"` (default `field`)

The one modal for add/edit forms: a native `<dialog>` opened with `showModal()`, centred, over a dimmed `::backdrop` (`--clr-shade-rgb`). Focus moves to its first field (or, with `focus="sheet"`, to the dialog itself, so a phone keyboard does not cover a sheet whose first control is a number field) and returns to the opener when it unmounts. Escape, the system back gesture (`cancel`) and a click on the backdrop call `onclose`; the parent decides and unmounts it. While an on-screen keyboard is up it sits above it (`--sheet-covered`, from `visualViewport`), so Save stays reachable. Opening it pushes a shallow history entry, so Android's Back (and the browser's) closes the sheet instead of leaving the page. `onclosed` runs only after that entry is gone, so a caller that navigates on save can't have its new page undone by the sheet's own Back. On a phone a short swipe down on the handle closes it (a quarter of its height, at most 120 px). `size="full"` is for long forms: the whole height below the status bar on a phone, a wider centred dialog on desktop. The form inside keeps its own card look. Used by `SaveToLibrary` (add / edit length), `PlanDialog`, `ManualEntrySheet` and `MatchSheet`. jsdom has no `showModal`, so `vitest-setup.ts` stubs it.

## LibraryFilterBar and LibraryFilterPanel

The Library's filter controller can render one standalone row: `[Filters ⊙n] [In progress ✕] [Movie 1] [Anime 2] …`. Props: `statuses`, `types`, `status`, `type`, `onstatus`, `ontype`, and `narrow` (tests pin it; the app follows `(max-width: 768px)`).
- **Filters** is an icon with its accessible name ("Filters", "Filters, 2 on"); the production search composition uses the icon at all sizes; the standalone default also shows the word on desktop. The badge counts `activeFilterCount`.
- Narrow, it opens `LibraryFilterPanel` in a bottom `Sheet` (`focus="sheet"`); wide, in a native `popover="auto"` placed by `followTrigger(trigger, panel, "end", true)`, bounded to the viewport and aligned with the button's trailing edge. Picks apply at once and the panel stays open; Escape or a tap outside closes it.
- The panel holds Status and Type as wrapping `SegmentedControl`s with Reset (disabled while nothing is on). Type hides when the library holds one type.
- The row has no All chip: nothing picked means all. A picked type stands alone, filled, with ✕ (`aria-pressed="true"`, "Anime 2, remove filter"); a picked status shows as a filled token ("Remove filter: In progress"). Chips with a 0 count are disabled through `withEmptyDisabled`, except the one picked.
- The chip row scrolls sideways; a mask fades whichever edge hides more chips. Chips animate (flip + fade) only while Animations are on.
- `LibraryFilters` and `filterEntries` are unchanged; the View row (Grid/Tree) stays its own row.

Production passes `children(trigger, chips)` to compose one controller across AppHeader slots: the trigger goes in `SearchField.trailing`, chips in the collapsible row. The icon is outline when inactive, filled with `--clr-accent` for any status/type filter. The search query alone does not activate it. Native `beforetoggle` updates ARIA promptly; positioning waits for `toggle`, when the panel has measurable dimensions.

## SessionPicker

- Files: `src/lib/components/library/SessionPicker.svelte`, `src/lib/domain/sessionScale.ts`
- Props: `scale` (a `SessionScale`), `choice` (bindable `SessionChoice { count, custom, typed }`), `label` (the group's accessible name), `pagesPerHour`, `disabled?`

How long one session is, in the Plan sheet ("Up to, per session") and the Log session sheet ("Session length"). `sessionScale(entry, pace)` decides the unit: whole episodes/chapters (step = minutes per unit, floor one unit) or time (30 min steps; the step and floor shrink to the item's length or what is left when shorter); it returns `null` for a movie or without a length, and the sheet shows a hint ("Add the pages above to pick a session.") or, for a movie, its own control. ‹ and › move one step, the centre is a filled button that resets to one unit (plain text for time), and **Custom** turns the centre into a minutes input that shows below it what the minutes are worth in units and time (`customText`: "6 chapters · 2 h", "≈ 3 chapters · 50 min", "≈ 25 pages · 50 min"), or "At least one episode (24 min)." under the floor (including an emptied Custom field), and "At most 12 h." over the limit. `openAt` picks where a sheet opens; `choiceMinutes`/`choiceOk` give the minutes to save and whether they are allowed. The sheet owns `choice` and derives minutes from it; the picker never saves. Pass a validated pace, never the raw input: a cleared field would render `NaN`.

## Add manually

- Files: `src/lib/stores/manualEntry.svelte.ts`, `src/lib/components/library/AddManuallyButton.svelte`, `src/lib/components/library/ManualEntrySheet.svelte`, `src/lib/components/library/ManualForm.svelte`

One sheet for the whole app, mounted once in `+layout.svelte`. Any screen adds an entry point with one line, e.g. `<AddManuallyButton type="book" title={query} variant="link" />` (variants: `button`, `link`, a 44 px `icon`). The button calls `manualEntry.open({ type, title, edit, after })`: `type` and `title` prefill the form, `edit` takes a manual key and switches to editing, and `after` is `"open"` (default: go to the new item) or `"stay"` (keep the page and show an "Added · Open" toast). The store owns the order close → history entry gone → navigate, so no button can get the double-Back wrong. Leaving the page closes the sheet. `ManualForm` asks before saving a look-alike title (same type, same title ignoring case and accents, same year when both have one) with "Save anyway" and "Open it".

## Find a match

- Files: `src/lib/stores/match.svelte.ts`, `src/lib/components/reconcile/MatchSheet.svelte`, `src/lib/components/reconcile/MatchCompare.svelte`

A manual item's page shows "Find a match" beside Edit, only while online. It calls `match.open(entry)`; the one `MatchSheet` (mounted in `+layout.svelte`) opens full size and searches the item's own type for its title through `catalog.fetchPage`, showing at most 8 `MediaCard`s under a `SearchField` the user can edit. Picking a card fetches its detail (length and metadata) and asks `libraryStore.preview`, the Rust dry run, so the compare step (`MatchCompare`: yours → the catalog's: each a poster, then its label, title, length and type · year, a replaced length struck through, a "What changes" list of old → new values from the pure `mergeChanges` in `domain/reconcile.ts`, a note when progress was capped, and one "Kept as is" line) shows exactly what will be saved; a refusal shows Rust's reason instead of "Use this", and a combine says so. "Use this" merges; like the add sheet, the store waits for the sheet's history entry to go, then lands on the catalog page with `replaceState`, so one Back leaves it. A "Matched" toast offers Undo for 10 s; Undo calls `unmerge` and returns to the manual page, or says why it was refused.

## BackToTop

- `src/lib/components/ui/BackToTop.svelte`: `threshold?`, `label = "Back to top"`; appears after scrolling past the threshold.

## SearchField

- File: `src/lib/components/ui/SearchField.svelte`
- Props: `label`, `value`, `onchange(value)`, `placeholder?`, `mode?: "instant" | "submit"` (default `instant`), `loading?`, `onsubmit?(query)`, `onclear?()`, `trailing?: Snippet`

One search input for the whole app; the parent owns `value`.

- `instant` (library filter): reports every keystroke; no landmark, no spinner. Its opaque `--clr-surface` background prevents scrolling covers/text from bleeding through the control. The surrounding header rows remain transparent.
- `submit` (home catalog): a `<form role="search">` the height of the app bar (`$bar-height`). Enter calls `onsubmit(value.trim())`, a blank value submits nothing. The spinner shows only while `loading` (the real request), and `aria-busy` follows it.
- In both modes the clear (×) button and Escape empty the field and call `onclear`; the clear button keeps focus in the input and is ≥ 44 px under `touch`. Home's `onclear` also drops the search results, like the "← Discover" link.

- Both modes fill their available container width. `trailing` is the final action inside the field, after Clear; input padding reserves room for both. Home passes its existing `MultiSelect` with `iconOnly`, retaining accessible Genres/count and native checkboxes.

## AppHeader

- `sticky?: boolean` defaults to true. Library, Planner, Profile and Settings pass false: the complete header stays in normal document flow, with no scroll listener, collapsed row or stuck safe-area shield. Home retains its sticky mode.
- Shared transparent sticky rows retain their layout footprint; only the complete `.collapsible-content` wrapper fades and translates on scroll. Delayed visibility hides it after exit; `inert` and pointer pass-through apply immediately. No height animation, backdrop blur or per-tag fade is added. Android retains its top safe-area protection.
- `collapseOnScroll` accumulates directional movement through small scroll samples; opposite-direction jitter resets that travel instead of flipping state. Motion follows the app setting and system preference live; off means no transition.
- Category tabs transition only color/background/shadow, not `all`: transitioning inherited visibility independently creates layered disappearance beneath the group fade.

## AppBackground

- File: `src/lib/components/ui/AppBackground.svelte`
- Props: optional `prefs: PrefsStore` (defaults to the singleton) and `currentLevel: number | null`; rendered once in `+layout.svelte`.

A fixed, `aria-hidden`, pointer-transparent decorative layer: base colour/radial glows, the equipped motif, then vignette. Existing `particlesFor` geometry and current-level equipment policy feed both renderers; the saved particle count remains authoritative.

- Hover/mouse uses scoped CSS motif keyframes. Touch/coarse input uses `.mobile-motif`, a canvas whose backing dimensions are capped at 240 × 480 and half CSS resolution. Touch hides only the desktop particle list, not the selected reward.
- Canvas uses `requestAnimationFrame` with a 30-fps drawing cadence; timestamp remainders prevent drift, elapsed time drives motion rather than frame count. Cleanup cancels the pending frame and disconnects the resize observer. The discarded 125ms timer candidate was visibly choppy at 8 fps.
- `MotionStore`, loaded preferences, visibility and focus gate work from the initial mount onward. Off/reduced motion, hidden/blurred windows, Default and ineligible saved motifs cannot keep a canvas frame loop alive. Desktop animation names are declared only under motion-on; keyframes stay Svelte-scoped.
- Colours come from live primary/accent channel tokens. No new preference, IPC, entitlement or schema is introduced.

Physical Galaxy A34 dev-WebView acceptance measured 29.99–30.03 canvas redraws/s, median gaps 33.3–33.4ms and worst sampled p95 36.9ms. App plus owned renderer used 85–90% of one CPU core versus 0.3–0.5% with motion off, an explicitly accepted tradeoff, not a low-power claim. Redraw timing is not display-presentation telemetry; other devices and standalone builds require their own measurements.

---

## Pages

The routes themselves are described in [SvelteKit Special Pages](Front-end/SvelteKit%20Special%20Pages.md).

## Layout (`src/routes/+layout.svelte`)

```svelte
<AppBackground />          <!-- fixed, z-index 0 -->
<div class="app-shell">    <!-- padded by --nav-left / --nav-bottom, or --toast-covered while a toast is open -->
  <AppNav {section} {progress} />
  <div class="app-content">  <!-- z-index 1 -->
    {@render children()}     <!-- each page renders its own AppHeader -->
  </div>
</div>
<OfflineBanner /> <LevelUpToast /> <ReminderToast /> <ManualEntrySheet /> <MatchSheet />
```

An open `Toast` reserves the height it covers (`ui/toastSpace.ts` sets `--toast-covered` on the root to the tallest open toast), so a page's last cards can scroll above it.
`--safe-bottom` (`env(safe-area-inset-bottom)`) is Android's navigation bar; `followTrigger` ends popovers above it.

The layout imports `$lib/styles/global.css`. It has no route guard; the startup-problem screen has no
navigation.

## Switch

- File: `src/lib/components/ui/Switch.svelte`
- Props: `label`, `hint?`, `checked`, `disabled?`, `motion?`, `onchange(checked)`

A `<button role="switch" aria-checked>` with its label and hint wired by `aria-labelledby` /
`aria-describedby`, so Space and Enter work natively. The track is 48×28; under touch an invisible
`::before` grows the hit area to 44 px. The thumb stops sliding when motion is off. Use it for
on/off settings; a choice between named options stays a `SegmentedControl`. An option can be `disabled` on its own, and counts show as accent badges.

## Themes

`prefs.theme` is `system`, `dark` or `light`. `applyTheme` (`src/lib/theme.ts`) sets
`data-theme` and `color-scheme` on `<html>` and remembers the choice; `static/theme-boot.js`
paints it before the app loads. `global.css` holds the dark palette on `:root` and the light one
under `[data-theme="light"]` and, for `system`, under `prefers-color-scheme: light`.
`scripts/contrast.test.mjs` (in `lint:guards`) checks every text/surface pair in both palettes (4.5:1 for text,
3:1 for hints and accents). Text on a filled (primary) background uses `--clr-on-primary`, derived from `--clr-on-primary-rgb`; an accent that needs dark text (Ember) overrides the channel, and every theme block sets the channel, never a literal. On Android, `applyTheme` also calls the
`AevumSystemBars` bridge from `MainActivity.kt` so the status and navigation bar icons turn dark on
the light theme.

## Profile artwork (completion crests)

- Files: `src/lib/domain/profileArt.ts`, `src/lib/components/profile/ProfileArtwork.svelte`,
  `src/lib/components/settings/ProfileArtworkSection.svelte`

The shared renderer and the Settings grid for 30 original pixel crests earned by completion.

- `ProfileArtwork` — props `art: string`, `size?: 24 | 32` (default 32), `scale?: 1 | 2 | 3 | 4`,
  `decorative?`. Draws one crest as unit-square `<path>`s (no curves or fractional geometry) with
  `shape-rendering="crispEdges"`; native 24 px in the nav and a 32 px base × 2 in the Profile card.
  The five tones (`.outline` `.shade` `.body` `.accent` `.glint`) all mix `--clr-primary` with the
  theme's `--clr-shade-rgb` / `--clr-highlight-rgb`, so a live accent change repaints every use.
  Decorative use sets `aria-hidden`; otherwise `role="img"` with `"<name> artwork"` as its label.
- `profileArt.ts` derives `PROFILE_ART` from the same completion requirements as everything else
  (six media × five tiers of 1 / 5 / 10 / 25 / 50 completed; no competing catalogue), with a
  distinct native 24 and 32 grid per media and five ornament tiers layered on a tier-1 silhouette.
- `ProfileArtworkSection` (mounted under Profile in Settings) offers Default plus currently earned crests
  in an earned-only image grid; locked previews remain in Journey Tree. A saved-but-now-locked choice explains itself and falls back to Default without clearing the selection.

## Compact Settings

Settings uses independent native accordions for Profile (artwork, title and Backup), Theme and Preferences. Theme and Profile equipment share `src/lib/components/settings/RewardPicker.svelte`: an effective-current-value trigger and a native top-layer group of static preview buttons. The existing equipment policies still own eligibility and saves; dropdown inspection never equips. Artwork and titles live under Profile. Existing `/settings#theme`, `#titles` and `#profile-artwork` links reveal their parent accordion. Accordion disclosure is local and nonpersistent; closing it preserves child form state. Preferences holds API keys, motion, reading pace and chapter pace; Backup retains export/import and Preferences retains replaying onboarding.

## Journey Tree (Library only)

- Files: `src/lib/components/progression/ProgressionTree.svelte`, `src/lib/components/progression/RunicTreeMap.svelte`, `src/lib/components/progression/BranchSheet.svelte`, `src/lib/components/progression/RewardSheet.svelte`; pure placement and geometry: `src/lib/domain/progressionTree.ts` (`journeyNodes`, `journeyEdges`, `treeBranches`).
- Tree props: `entries: LibraryEntry[]` (visible entries), `allEntries: LibraryEntry[]` (successful full-library authority), `currentLevel: number | null`, `loaded?: boolean` (defaults false), `error?: string`, `onclear?: () => void`.
- The main map retains THE SHARED ROOT above JOURNEY TREE and six existing media crests. Each opens one media subtree: five completion-art nodes plus four global rewards for Movies/TV or three for Anime/Manga/Books/Games. Every global reward has one home, never six copies: Movies owns Bubbles/Ember/Newcomer/Curious Mind; TV owns Embers/Runic shimmer/Regular/Enthusiast; Anime owns Aurora/Connoisseur/Devotee; Manga owns Dusk/Archivist/Curator; Books owns Sunrise/Loremaster/Chronicler; Games owns Ocean/Midnight/Aevum Eternal.
- Nodes sort by required level from root to crown. `journeyEdges` derives the connected topology and SVG endpoints from the same seal coordinates as the buttons; an edge lights only when both endpoints currently qualify. Connections are layout, not extra prerequisites. Global rewards remain level-only; artwork still needs current level and current completed count. `seen_level` never grants eligibility.
- Real buttons remain at least 44 px, including locked nodes. Short labels, visible required levels and Available/Locked text keep the map readable; full descriptions expose completion requirements accessibly. Reused Settings previews show motifs, themes and accents; titles use a text seal and existing artwork uses ProfileArtwork. All taps open the existing RewardSheet, never equip or save. The separate earlier/current/later level ladder and its unused paging helpers are removed.
- The media map uses a measured 64rem height, narrower three-column rows and wider one/two-column rows, without shrinking text or targets. Layout transitions are disabled so seals and SVG endpoints remain aligned on the first rendered frame, including Animations off. Pixel channels, runes and artwork follow the equipped accent; earned edges use the live accent and locked edges stay neutral.
- Canonical `allEntries` and successful activity/library loading own completion eligibility; filters affect only genre/item leaves. Missing authority hides stale progress rather than fabricating empty/earned states. Bounds remain six genre branches per page, six preview links per branch and thirty item links per BranchSheet page; branch paging clamps when entries disappear and manual IDs use normal encoded routes.
- The active media derives from transient SvelteKit `page.state.runewood`, scoped to the component id. Sheet preserves parent page state: Back closes the preview, restores its opener, then returns to the main map and focuses its crest. All media clears sticky chrome. No preference or IPC writes occur during navigation.
- RewardSheet accepts `kind`, `rewardId`, `entries`, `currentLevel`, `onclose`; existing requirements and Settings destinations `#theme`, `#titles`, `#profile-artwork` are reused. Settings is the sole equipment UI; modal navigation waits for Sheet history to close.
- Library retains internal view id `garden`, Grid default and an empty-library Tree selector. Profile no longer mounts a tree: LevelCard, equipped artwork, stats, dashboard graphs and chart accessibility remain.
- Runic shimmer retains stored id `sway`, kind/prefs slot `garden` and minimum level 8. When equipped and motion is permitted, visible channels, map roots and crown runes reveal once for 600ms per map entry, then settle. The map is keyed by selected media so navigation replays that brief reveal; filter edits do not. Reduced motion and Animations off override it. Existing `motion?`/`shimmer?` test overrides remain gated by current level and successful authority. No persistence, schema, IPC or reward-definition changes.

## AppNav and LevelRing

- `ui/AppNav.svelte` — props `section` (from `sectionOf` in `domain/navigation.ts`) and optional
  `progress`. One `<nav aria-label="Main">` of links: a left rail (`$nav-rail-width`) with Settings
  pinned to its bottom on desktop; a bottom tab bar (`$nav-bar-height` + safe area) without
  Settings at `md` and below. The current tab has a filled pill and `aria-current="page"`.
- A detail page keeps the tab it was opened from (the layout remembers the last section); opened
  cold it belongs to Home. `/welcome` has no tab.
- The level ring sits on the Profile tab, whose name becomes "Profile · Level N"; Settings is a
  link in the Profile header. (The desktop `LevelChip` was removed with the sticky header.)
- `ui/LevelRing.svelte` — the decorative ring.
- When a completion crest is equipped, a decorative 24 px `ProfileArtwork` replaces the Profile
  glyph; the level ring and the "Profile · Level N" name stay.
- Fixed overlays (OfflineBanner, BackToTop, toasts) add `var(--nav-bottom)` / `var(--nav-left)`,
  set on `:root` by the layout, so they stay clear of the navigation.

### Large-library hydration

`LibraryStore.hydrate()` replaces its reactive map atomically with the loaded canonical entries. It does not schedule a reactive map update for each saved item. The production regression loads 5,100 items across six media at level 200, opens all six maps and pages to the last real branch member without page errors.

### Settings entry and ownership

Settings renders Profile (artwork, title and Backup), Theme, then Preferences. Profile seeds native disclosure open once per mount; closing it is respected until the next visit. Hash links reveal their owner, including `#backup-title`, without preference writes or exclusive accordion behavior. The Settings header remains in normal document flow. Its Back action reuses `goBack`, falling back to `/profile` with replacement on cold entry; navigation never writes preferences. ThemeSection opts into RewardPicker’s `stacked` label/name-above-preview layout, leaving Avatar, Title, selection behavior and top-layer popovers unchanged.

### Mobile navigation selection

The bottom navigation fills the complete selected link with `--clr-primary` and labels/icons with `--clr-on-primary`. Settings lights Profile via `within` without falsifying the current-page semantics. Local icon tokens retain readable Profile artwork and its level ring; the desktop rail retains its icon-only wash. Dusk and Ocean use dark paired foregrounds, like Ember, to meet 4.5:1 small-label contrast without changing their primary hues.

### Planning weekday gestures

`PlanSheet` owns the shared create/edit day picker: seven compact pills in one horizontal grid, abbreviated visual labels with full accessible names and at least 44px touch targets at enlarged text scale. Horizontal interval hit-testing includes skipped intermediate days. A primary pointer captures the group and paints each crossed weekday once in select/clear mode chosen at its start; cancellation/lost capture restores the pregesture draft. Pointer release never saves. Keyboard/assistive activation uses native buttons and `aria-pressed`. Touch-action is suppressed only on the picker, leaving the sheet scrollable elsewhere. Numeric weekday IDs and the existing plan-save pipeline are unchanged. Unit schedule tests use keyboard activation; actual pointer capture and touch cancellation run in the browser.

### Welcome teaching and API-key drafts

Welcome stores `garden`, `keys`, `planner`, `pace`, `manual` at stable indexes 0/1/3/4/5. Legacy index 2 skips to planner. Legacy taste fields remain serialized but neither welcome nor Home reads or writes them. Home starts on Movies and retains manual category navigation within the session. Four locally seeded real-component illustrations are inert, have no dialogs or remote posters, and do not save. Equipment remains in Settings. Planning copy distinguishes scheduling from logging and pages/hour from minutes/chapter, then explains manual entry and same-type catalog matching/conditional Undo. Key CTA labels use saved presence plus nonblank drafts; Continue validates and saves each pending draft through the existing keys store before advancing. Pending validation locks navigation and key inputs; failed checks/saves retain drafts, provider errors and the current beat. No new persistence fields or reward rules.

### Avatar and Profile hero

`ProfileAvatar` shares the Default glyph and existing artwork renderer across Settings and navigation; LevelCard centers it inside the same clockwise twelve-o’clock LevelRing used by navigation, with title then current level below. The Settings Avatar consumer filters choices by current level/completion eligibility and uses RewardPicker’s image-only variant; locked previews stay in Journey Tree. Saved unavailable/unknown equipment is retained with the normal fallback and no repair writes. Profile removes the Activity heatmap and its grid area, not event history, streaks or the library Taste chart.
