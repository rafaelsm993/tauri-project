---
description: "Add a new media provider to Aevum by following the AGENTS.md provider checklist."
agent: "tauri-app"
model: "Claude Opus 4.6 (copilot)"
argument-hint: "Provider name and API details (e.g., 'Spotify API for music search and album details')"
tools: [read, edit, search, execute, todo]
---

Add a new media provider to Aevum.

The one source of truth for how to do this is the **"Adding a provider"** checklist in [AGENTS.md](../../AGENTS.md), together with its Rust and frontend conventions. Read it first and follow it step by step; use `src-tauri/src/api/rawg.rs` (a small provider with a concurrent detail fetch) as the reference implementation.

In short: providers live only in Rust behind the `Provider` trait in `src-tauri/src/api/catalog.rs` and map into the DTOs in `src-tauri/src/api/types.rs`. No new IPC commands and no TypeScript per provider. Work test-first and finish with `npm run verify` green.

Provide a summary of all files created/modified when done.
