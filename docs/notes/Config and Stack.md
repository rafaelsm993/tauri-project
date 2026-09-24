# tauri-app — Config and Stack

> Manifests, config files, dependencies and system requirements.

## 1. package.json

`"type": "module"`: all `.js` files use ES modules.

### Scripts

| Script | What it does |
| --- | --- |
| `dev` | Vite dev server on port 1420 with HMR |
| `build` | Static SPA into `build/` |
| `preview` | Serve the production build locally |
| `check` | `svelte-kit sync` + `svelte-check` (type-checks `.svelte` and `.ts`) |
| `check:watch` | Same as `check`, in watch mode |
| `tauri` | Tauri CLI proxy: `npm run tauri dev`, `npm run tauri build` |
| `format` | Prettier writes every file |
| `lint` | `prettier --check` + ESLint + `lint:bp` + `lint:en` + `lint:colors` + `lint:guards` |
| `lint:bp` | Breakpoint lint: raw px inside `@media` fails (`scripts/check-breakpoints.mjs`) |
| `lint:en` | English-only guard (`scripts/english-only.test.mjs`) |
| `lint:colors` | Runtime-color guard for `.svelte` files (`scripts/colors.test.mjs`) |
| `lint:guards` | Docs-vs-code guard (`scripts/docs-notes.test.mjs`) and toolchain check (`scripts/verify-toolchain.test.mjs`) |
| `test` / `test:watch` | Vitest (jsdom, `@testing-library/svelte`) |
| `test:ui` | Playwright on 5 viewports with faked IPC (`e2e/`) |
| `verify` | The gate: `verify:fe` (lint, check, test, test:ui) + `verify:rs` (cargo fmt, clippy `-D warnings`, test) |

## 2. Runtime dependencies

| Package | Purpose |
| --- | --- |
| `@tauri-apps/api` ^2.11 | `invoke()` to Rust commands |
| `@tauri-apps/plugin-log` ^2.9 | Forwards frontend `console.*` to the Rust log sinks |
| `@tauri-apps/plugin-opener` ^2 | Opens URLs in the system browser (plugin is registered; no frontend call site yet) |

## 3. Dev dependencies

| Package | Version | Role |
| --- | --- | --- |
| `vite` | ^6.0.3 | Bundler, dev server, HMR |
| `@sveltejs/kit` | ^2.9.0 | Routing, `$app/*`, build |
| `@sveltejs/vite-plugin-svelte` | ^5.0.0 | Compiles `.svelte`; `vitePreprocess()` for TS/SCSS |
| `@sveltejs/adapter-static` | ^3.0.6 | Static output to `build/` |
| `@tauri-apps/cli` | ^2.11 | `tauri` command |
| `svelte` | ^5.0.0 | Compiler |
| `typescript` | ~5.6.2 | Types |
| `sass` | ^1.97.3 | SCSS |
| `svelte-check` | ^4.0.0 | `npm run check` |
| `vitest`, `jsdom`, `@testing-library/{svelte,jest-dom,user-event}` | ^5 / ^30 / … | Unit and component tests |
| `@playwright/test` | ^1.63 | Responsive e2e (`e2e/responsive.spec.ts`) |
| `eslint`, `typescript-eslint`, `eslint-plugin-svelte`, `prettier`, `prettier-plugin-svelte` | — | Lint and format |

## 4. Config files

- `svelte.config.js` does two things: it enables `vitePreprocess()` and sets `adapter-static({ fallback: "app.html" })`.
- `vite.config.js`:
  - `plugins: [sveltekit()]`
  - `css.preprocessorOptions.scss`: `loadPaths: ["src/lib/styles"]` plus `additionalData: "@use 'variables' as *;"`. This auto-injects the SCSS variables and mixins into every component.
  - `server`: port 1420, `strictPort`, optional `TAURI_DEV_HOST` for HMR on 1421, and `src-tauri/**` excluded from watching.
- `src/routes/+layout.ts` sets `export const ssr = false`.
- `src-tauri/tauri.conf.json`:
  - dev URL `http://localhost:1420`; `frontendDist: "../build"`
  - one 800×600 window, minimum 360×560 (so phone layouts are reachable on desktop), devtools on
  - `identifier: com.user.tauri-app` (placeholder until the name is chosen)
  - `csp: null`
  - bundles all targets
- `src-tauri/capabilities/default.json` grants `core:default`, `opener:default` and `log:default` to the `main` window.
- `src-tauri/build.rs`:
  - reads `../.env` and emits every `KEY=value` line as `cargo:rustc-env`
  - reruns when `.env` changes, then calls `tauri_build::build()`

## 5. Svelte 5 runes

| Rune | Purpose | Example |
| --- | --- | --- |
| `$state(v)` | Reactive state | `let page = $state(1)` |
| `$derived(expr)` | Computed value | `const carouselMode = $derived(!isSearch && activeGenre === null)` |
| `$effect(() => {})` | Side effect, re-runs on dependency change | observer re-attach, detail fetch |
| `$props()` | Component props | `let { item, onclick } = $props<…>()` |

This project keeps its shared state in `.svelte.ts` class stores built with runes, instead of `svelte/store`. That is a project convention; Svelte itself supports both.

## 6. Rust / Cargo (`src-tauri/Cargo.toml`)

| Crate | Version | Features | Purpose |
| --- | --- | --- | --- |
| `tauri` | 2 | — | App framework, IPC, windows |
| `tauri-plugin-opener` | 2 | — | Open URLs/files |
| `serde` | 1 | `derive` | Serialization |
| `serde_json` | 1 | — | Reading provider bodies before typed decode; AniList GraphQL variables |
| `reqwest` | 0.12 | `json`, `rustls-tls` (no default features) | HTTP to providers |
| `tokio` | 1 | `full` | Async runtime, `join!` |
| `tauri-plugin-log` + `log` | 2 / 0.4 | — | Logging to terminal, file, logcat |
| `tauri-build` (build) | 2 | — | Codegen |

Build profiles (the reasoning is in [BUILD_AND_RUN.md](../BUILD_AND_RUN.md)):

- dev: `debug = 1`, 256 codegen units, incremental
- dependencies in dev (`[profile.dev.package."*"]`): `opt-level = 3`
- release: thin LTO, 1 codegen unit, `panic = "abort"`, stripped

## 7. External APIs and `.env`

| API | Base | Auth | Used for |
| --- | --- | --- | --- |
| TMDB v3 | `api.themoviedb.org/3` | `TMDB_API_KEY` | Movies, TV |
| AniList | `graphql.anilist.co` | none | Anime, manga |
| RAWG | `api.rawg.io/api` | `RAWG_API_KEY` | Games |
| iTunes | `itunes.apple.com` | none | Books |

Repo-root `.env` (gitignored; template: `.env.example`):

```env
TMDB_API_KEY=...
RAWG_API_KEY=...
```

Both keys must be present at compile time, because `env!()` fails the build otherwise (CI uses dummy values). A runtime environment variable with the same name overrides the embedded value. Optional: `TAURI_APP_LOG` (log level) and, in dev, `TAURI_APP_DEVTOOLS=1` (open the inspector).

## 8. System requirements

- Node.js ≥ 20 (Windows side currently v22)
- Rust stable via rustup
- **Windows laptop (WSL → Windows):** VS Build Tools with the C++ workload, the MSVC Rust target, and the WebView2 runtime. Details and `scripts/verify.ps1` are in [BUILD_AND_RUN.md](../BUILD_AND_RUN.md).
- **Linux native:**
  - Ubuntu: `libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev pkg-config`
  - Arch: `rustup webkit2gtk-4.1 libsoup3 base-devel openssl librsvg`. Setup and troubleshooting: [BUILD_AND_RUN.md](../BUILD_AND_RUN.md).
- **Android:** Android SDK (`ANDROID_HOME`), NDK 27.3 (`NDK_HOME`), JDK 17, Rust targets `aarch64-linux-android` (devices) and `armv7-linux-androideabi` (older phones). The project lives in `src-tauri/gen/android` (generated by `tauri android init`; never edit by hand). Details: [BUILD_AND_RUN_ANDROID.md](../BUILD_AND_RUN_ANDROID.md).
- See also the official [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## 9. CI (`.github/workflows/ci.yml`)

Runs on pushes to `main` and PRs into `main`/`release/*`, with dummy API keys:

| Job | Runner | What it proves |
| --- | --- | --- |
| `verify` | ubuntu-22.04 | The full `npm run verify` gate |
| `windows` | windows-latest | `npm run verify:rs` + `tauri build --no-bundle` (MSVC compile and link) |
| `android` | ubuntu-22.04 | Debug APK for arm64 (`tauri android build --debug --apk --target aarch64`), uploaded as an artifact |

## How it connects

```
npm run tauri dev
└─► @tauri-apps/cli
      ├─► vite dev (:1420)           → SvelteKit SPA
      └─► cargo build → Tauri window → catalog_* commands
              └── reqwest → TMDB / AniList / RAWG / iTunes
```
