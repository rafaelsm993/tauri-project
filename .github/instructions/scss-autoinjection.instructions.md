---
description: "Use when editing or creating Svelte component style blocks. Enforces SCSS auto-injection rule: never add @use, @import, or @forward in <style lang='scss'> blocks."
applyTo: "src/**/*.svelte"
---

# SCSS Auto-Injection Rule

All SCSS variables and mixins from `src/lib/styles/variables.scss` are automatically injected into every `<style lang="scss">` block via Vite's `additionalData` config.

## Available without imports

**Variables** (non-color, compile-time): `$spacing-xs` through `$spacing-2xl`, `$radius-sm` through `$radius-full`, `$font-display`, `$font-body`, `$font-mono`, `$bp-sm` through `$bp-2xl`, `$dur-fast`, `$dur-normal`, `$dur-slow`, `$dur-slower`, `$ease-out-expo`, `$ease-out-back`, `$touch-target`

**Mixins**: `@include glass()`, `@include card-lift`, `@include truncate`, `@include label-style`, `@include respond-to(md)`, `@include touch`, `@include hover-capable`, `@include flex-center`, `@include flex-between`, `@include fill`, `@include sr-only`, `@include glow-primary`

## Rule

- **NEVER** add `@use`, `@import`, or `@forward` inside a `<style lang="scss">` block
- Use SCSS variables and mixins directly — they are already in scope
- Colors are runtime CSS custom properties from `global.css` only: `var(--clr-primary)`, and alpha via channels `rgb(var(--clr-primary-rgb) / 0.12)`. No hex, numeric `rgb()` or SCSS color functions; `npm run lint:colors` enforces it (see AGENTS.md)
