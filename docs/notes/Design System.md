# Aevum — Design System

> Tokens and styling rules. Colors live only in the `:root` block of `src/lib/styles/global.css` (CSS custom properties, runtime). Non-color tokens (spacing, radii, fonts, breakpoints, motion) are SCSS in `src/lib/styles/variables.scss` (compile-time).

## Philosophy

A dark, cinematic UI modelled on Netflix: a red primary colour, glass surfaces and smooth motion. It uses no UI framework, only CSS tokens and SCSS variables.

- `<script lang="ts">` — TypeScript for type safety
- `<style lang="scss">` — SCSS with auto-injected variables/mixins (never `@use`/`@import`)
- Reactive globals via Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Animations use CSS transitions and keyframes only (no Canvas).

---

## Color Palette

Colors are **runtime tokens**, so a theme is a set of `--clr-*-rgb` overrides on `:root` with no per-component code (S1·A4). Each palette color has a **channel token** (space-separated RGB) and a derived color:

| Channel token | Value | Derived | Usage |
| --- | --- | --- | --- |
| `--clr-bg-rgb` | `0 0 0` | `--clr-bg` | Main background |
| `--clr-surface-rgb` | `10 10 10` | `--clr-surface` | Cards, panels, skeleton |
| `--clr-surface-2-rgb` | `20 20 20` | `--clr-surface-2` | Glass surfaces |
| `--clr-primary-rgb` | `229 9 20` | `--clr-primary`, `--clr-primary-subtle` | Brand red: actions, accents, glows |
| `--clr-accent-rgb` | `178 7 16` | `--clr-accent` | Darker red, hover states |
| `--clr-teal-rgb` | `70 211 105` | `--clr-teal` | Success (e.g. SearchBar submitted) |
| `--clr-error-rgb` | `255 82 99` | `--clr-error` | Error text and borders |
| `--clr-ink-rgb` | `255 255 255` | `--clr-ink`, `--clr-border`, `--clr-border-2` | Light overlays on dark (flips for a light theme) |
| `--clr-shade-rgb` | `0 0 0` | shadows | Dark overlays and shadows |
| `--clr-scrim-rgb` | `8 11 16` | — | Hero/backdrop scrims |
| `--clr-highlight-rgb` | `232 184 75` | — | Highlight accents |

Text: `--clr-text` (`#f5f5f1`), `--clr-text-2` (`#b3b3b3`), `--clr-text-3` (`#808080`), `--clr-text-inv` (black).

Family hues (placeholders until the design task picks them): `--clr-hue-screen-rgb` (= primary, movie + TV), `--clr-hue-anime-rgb`, `--clr-hue-manga-rgb`, `--clr-hue-book-rgb`, `--clr-hue-game-rgb`. Not used by components yet.

### Using colors in components

```scss
color: var(--clr-primary);
background: rgb(var(--clr-primary-rgb) / 0.12);   // alpha via the channel token
border: 1px solid rgb(var(--clr-ink-rgb) / 0.1);  // white overlay
```

`npm run lint:colors` (part of `npm run lint`) fails on hex, numeric `rgb()`/`hsl()`, and SCSS color functions (`rgba($x, …)`, `darken`, `lighten`, `mix`…) in any `.svelte` file. Opt out per line with `// colors: allow`. Need a new color? Add a channel token to `global.css` first.

---

## Typography

| Role               | Font       | CSS Variable     | SCSS Variable   |
| ------------------ | ---------- | ---------------- | --------------- |
| Display / Titles   | Bebas Neue | —                | `$font-display` |
| Body / UI          | DM Sans    | `--font-body`    | `$font-body`    |
| Monospace / Labels | DM Mono    | `--font-mono`    | `$font-mono`    |

### Type Scale (CSS custom properties)

| Token        | Size     | Pixels |
| ------------ | -------- | ------ |
| `--size-xs`  | 0.75rem  | 12px   |
| `--size-sm`  | 0.875rem | 14px   |
| `--size-md`  | 1rem     | 16px   |
| `--size-lg`  | 1.125rem | 18px   |
| `--size-xl`  | 1.375rem | 22px   |
| `--size-2xl` | 1.75rem  | 28px   |
| `--size-3xl` | 2.25rem  | 36px   |

### Line Height & Letter Spacing

| Token               | Value  |
| ------------------- | ------ |
| `--leading-snug`    | 1.3    |
| `--leading-normal`  | 1.5    |
| `--tracking-wide`   | 0.06em |
| `--tracking-widest` | 0.2em  |

---

## Spacing

### SCSS Variables (component-scoped)

| Variable       | Value |
| -------------- | ----- |
| `$spacing-xs`  | 4px   |
| `$spacing-sm`  | 8px   |
| `$spacing-md`  | 16px  |
| `$spacing-lg`  | 24px  |
| `$spacing-xl`  | 32px  |
| `$spacing-2xl` | 48px  |

### CSS Custom Properties (global)

`--space-1` … `--space-6` and `--space-8` (4px to 32px) — follows the 4px base grid.

---

## Border Radius

| Variable / Token                 | Value  |
| -------------------------------- | ------ |
| `$radius-sm` / `--radius-sm`     | 4px    |
| `$radius-md` / `--radius-md`     | 8px    |
| `$radius-lg` / `--radius-lg`     | 14px   |
| `$radius-xl`                     | 20px   |
| `$radius-full` / `--radius-full` | 9999px |

---

## Glows

| Token           | Usage                                      |
| --------------- | ------------------------------------------ |
| `--glow-primary` | Primary (red) glow — same as `@include glow-primary` |

---

## Motion

### Easing Curves

| SCSS Variable    | Curve                               | Character                     |
| ---------------- | ----------------------------------- | ----------------------------- |
| `$ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)`     | Smooth deceleration — primary |
| `$ease-out-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot — playful emphasis  |

### Durations

| SCSS Variable | Value | Usage                               |
| ------------- | ----- | ----------------------------------- |
| `$dur-fast`   | 120ms | Micro-interactions (opacity, color) |
| `$dur-normal` | 220ms | Standard transitions                |
| `$dur-slow`   | 380ms | Cards, overlays                     |
| `$dur-slower` | 600ms | Page-level animations               |

---

## Breakpoints

| SCSS Variable | Value  | Target        |
| ------------- | ------ | ------------- |
| `$bp-sm`      | 480px  | Small phones  |
| `$bp-md`      | 768px  | Tablets       |
| `$bp-lg`      | 1024px | Small laptops |
| `$bp-xl`      | 1280px | Desktops      |
| `$bp-2xl`     | 1440px | Large screens |

Usage: `@include respond-to(md) { ... }` (desktop-first, max-width media query). Raw px inside `@media` fails `npm run lint:bp`.

Input, not width: `@include touch` (`hover: none` or coarse pointer) and `@include hover-capable` (fine pointer with hover). Touch targets are at least `$touch-target` (44px) under `touch`.

---

## Z-Index Stack

| Layer      | Z-Index            | Element                                               |
| ---------- | ------------------ | ----------------------------------------------------- |
| Background | 0                  | `.bg-layer` — CSS bubbles, glows, vignette (`AppBackground`) |
| Content    | 1                  | `.app-content` — all page content                     |
| Film grain | 4                  | `body::before` — noise overlay (pointer-events: none) |
| Raised     | `--z-raised: 10`   | Cards on hover                                        |
| Modal      | `--z-modal: 200`   | Modal dialogs                                         |
| Toast      | `--z-toast: 300`   | Notifications                                         |

---

## SCSS Mixins

All mixins are auto-injected — use directly in `<style lang="scss">` blocks.

| Mixin                      | Usage                             | What It Does                                          |
| -------------------------- | --------------------------------- | ----------------------------------------------------- |
| `@include glass($blur)`    | `.panel { @include glass; }`      | Frosted glass surface: translucent bg + blur + border |
| `@include card-lift`       | `.card { @include card-lift; }`   | Hover: translateY(-6px) + scale(1.02) + red glow      |
| `@include glow-primary`    | `.badge { @include glow-primary; }` | Primary box-shadow aura (`--glow-primary`)          |
| `@include truncate`        | `.title { @include truncate; }`   | Single-line ellipsis                                  |
| `@include label-style`     | `.tag { @include label-style; }`  | Uppercase mono label (DM Mono, 0.7rem, `var(--clr-primary)`) |
| `@include respond-to($bp)` | `@include respond-to(md) { ... }` | Max-width media query                                 |
| `@include touch`           | `@include touch { min-height: $touch-target; }` | Touch / coarse-pointer input          |
| `@include hover-capable`   | `@include hover-capable { &:hover { … } }` | Hover effects only where hover exists  |
| `@include flex-center`     | `.box { @include flex-center; }`  | Centered flexbox                                      |
| `@include flex-between`    | `.row { @include flex-between; }` | Space-between flexbox                                 |
| `@include fill`            | `.overlay { @include fill; }`     | `position: absolute; inset: 0`                        |
| `@include sr-only`         | `.label { @include sr-only; }`    | Visually hidden, accessible                           |

---

## Component Styling Rules

1. **All styles scoped**: Use `<style lang="scss">` in every component
2. **No imports**: NEVER add `@use`, `@import`, or `@forward` — variables/mixins are auto-injected
3. **Tokens only**: don't hardcode colors, spacing, or fonts
4. **Colors are CSS custom properties**: `var(--clr-primary)`, alpha via `rgb(var(--clr-primary-rgb) / 0.12)`; enforced by `npm run lint:colors`
5. **Non-color tokens are SCSS**: `$spacing-*`, `$radius-*`, `$font-*`, `$dur-*`, `$bp-*`
