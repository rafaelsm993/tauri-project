# Contributing to Aevum

## Branch Strategy

```
main         ← stable, protected (no force-push/delete, signed commits required)
release/x.y  ← release candidate branch (created from main before tagging)
feat/name    ← new features
fix/name     ← bug fixes
chore/name   ← tooling, deps, dependency bumps
docs/name    ← documentation only
refactor/name← internal restructuring, no behavior change
test/name    ← test-only changes
```

One-level type prefix (`type/short-kebab-slug`), matching the Conventional
Commits type used in the branch's commits. **Not** `feature/name` or
`bug/name` — use `feat/` and `fix/` to stay consistent with the commit
message types below. For sprint-scoped work, slug it after the sprint file,
e.g. `feat/s2-data-foundation` — keeps branch, sprint doc (`docs/sprints/`),
and commits traceable to the same unit of work.

### Flow

```
feat/my-feature  ──PR──▶  main  ──PR──▶  release/1.2
                                              │
                                          tag v1.2.0
```

1. All day-to-day work branches off **`main`**
2. When a release is ready, open a PR from `main` → `release/x.y`
3. Only bug fixes go into `release/x.y` after branching
4. When the release branch is stable, tag it `vX.Y.Z`
5. Tag push triggers the GitHub Actions release workflow (builds installers)

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(media): add anime search via Jikan API
fix(background): remove mix-blend-mode causing WebView flicker
chore(deps): bump tauri to 2.11
docs(readme): add installation steps
refactor(tmdb): extract mapPage helper
```

Types: `feat` `fix` `chore` `docs` `refactor` `test` `perf` `ci`

## Setup

```bash
# 1. Clone and install
git clone https://github.com/rafaelsm993/tauri-project
cd tauri-project
npm install

# 2. Configure secrets
cp .env.example .env
# Edit .env — add your TMDB_API_KEY

# 3. Run dev
npm run tauri dev
```

## Adding a New API Provider (Jikan, OpenLibrary, etc.)

1. Add Rust commands in `src-tauri/src/api/<provider>.rs`
2. Register commands in `src-tauri/src/lib.rs`
3. Create `src/lib/api/<provider>.ts` — implement `search()` and `discover()`, map to `MediaItem`
4. No changes needed to `MediaCard` or `+page.svelte` — they consume `MediaItem` generically
