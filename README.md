# Aevum

> **Aevum** (Latin, *an age; a lifetime*) is the scholastic term for the kind of
> time that sits between mortal hours and eternity — the duration angels were
> said to live in. The app is about the hours you spend on stories and games:
> it keeps them, plans them, and grows something from them. Chosen 2026-09-24
> over Chronicle, Hourkeep and Tempus (all common or taken); see
> `GOALS-QA.md` §6.15 K5.1 in the vault.

A cross-platform media tracker built with **Tauri 2**, **SvelteKit**, and **Rust**.

Tracks movies, TV series, anime, manga, books, and games via TMDB, AniList, RAWG, and iTunes.

Build and run on the Arch desktop or on WSL + Windows 11: see [Build and run runbook](docs/BUILD_AND_RUN.md).

Architecture, API, component and design-system notes: see [Design notes](docs/notes/README.md).

## Stack

| Layer    | Technology                   |
| -------- | ---------------------------- |
| Frontend | SvelteKit + Svelte 5 runes   |
| Styling  | SCSS + CSS custom properties |
| Backend  | Rust (Tauri 2 commands)      |
| APIs     | TMDB, AniList, RAWG, iTunes |

## Getting Started

```bash
# Prerequisites: Node 20+, Rust stable, system WebView

git clone https://github.com/rafaelsm993/tauri-project
cd tauri-project
npm ci
cp .env.example .env   # fill in TMDB_API_KEY and RAWG_API_KEY
npm run tauri dev      # Arch desktop; on the Windows laptop use ./scripts/wdev.sh from WSL
```

## Building

```bash
npm run tauri build -- --no-bundle   # Arch: binary at src-tauri/target/release/aevum
./scripts/wdev.sh build              # Windows laptop (from WSL): MSI + NSIS in src-tauri/target/release/bundle/
npm run tauri android build -- --debug --apk --target aarch64   # Android debug APK in src-tauri/gen/android/app/build/outputs/apk/
```

Android (phone dev loop with hot reload, APKs): see [Android runbook](docs/BUILD_AND_RUN_ANDROID.md).

## Development workflow

Conventions, TDD loop and the quality gate live in [AGENTS.md](AGENTS.md). Before any PR: `npm run verify`.

## Branch Model

| Branch        | Purpose                                    |
| ------------- | ------------------------------------------- |
| `main`        | Protected — all work branches from here     |
| `release/x.y` | Release candidate — fixes only              |
| `feat/*`      | Feature branches (from main)                |
| `fix/*`       | Bug fix branches (from main)                |
| `chore/*`     | Tooling, deps, dependency bumps             |
| `docs/*`      | Documentation-only changes                  |
| `refactor/*`  | Internal restructuring, no behavior change  |
| `test/*`      | Test-only changes                           |

See [CONTRIBUTING.md](CONTRIBUTING.md) for full workflow.

## Environment Variables

| Variable       | Required | Description                  |
| -------------- | -------- | ---------------------------- |
| `TMDB_API_KEY` | Yes      | Must be defined at Rust compile time; valid key needed for movies/TV |
| `RAWG_API_KEY` | Yes      | Must be defined at Rust compile time; valid key needed for games |
| `TAURI_APP_LOG` | No      | Log level: `trace`, `debug`, `info`, `warn`, `error`, `off`. Default: `debug` in dev builds, `info` in release |

Logs go to the terminal, to `<app-log-dir>/aevum.log` (Linux: `~/.local/share/com.rafaelsm993.aevum/logs/`), and to logcat on Android. Frontend `console.*` calls show in the devtools console and are also forwarded to the terminal and log file; Rust logs are not mirrored into devtools. Provider errors never include request URLs, so API keys are never logged or shown in the UI.

Copy `.env.example` to `.env` at the project root and fill these in before starting development or building. Rust keys are embedded at compile time and can be overridden by runtime environment variables. AniList and iTunes require no API key.

## License

MIT
