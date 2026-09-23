# Design notes

These notes were moved here from the author's Obsidian vault (`Programming/Tauri_APP/`) on 2026-09-22 and rewritten to match the current app (updated after S1): Home + Detail over TMDB, AniList, RAWG and iTunes, behind a typed Rust facade, with placeholder routes for later screens. The legacy notes about accounts, the watchlist, cloud sync and the companion server were not migrated. They remain in the vault's git history.

When a note disagrees with the code, the code is right. `npm run lint:guards` (part of `npm run verify`) checks the notes against the code.

| Note | Covers |
| --- | --- |
| [Architecture](Architecture.md) | Topology, SPA setup, data flow, state, background layers, build |
| [API Reference](API%20Reference.md) | The `catalog_*` commands, the `Provider` trait, per-provider rules, shared types and `media_key` |
| [Component Patterns](Component%20Patterns.md) | Props and behaviour of each UI component, root layout |
| [SvelteKit Special Pages](Front-end/SvelteKit%20Special%20Pages.md) | `+` file conventions, the Home, Detail and placeholder routes |
| [Config and Stack](Config%20and%20Stack.md) | Scripts, dependencies, config files, `.env`, system requirements |
| [Design System](Design%20System.md) | Runtime color tokens, type, spacing, motion, z-index tokens, SCSS mixins |

Related: [BUILD_AND_RUN.md](../BUILD_AND_RUN.md) (WSL → Windows build).
