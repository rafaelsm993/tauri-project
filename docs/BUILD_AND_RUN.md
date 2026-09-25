# Building and running Aevum

| Machine | Run (hot reload) | Release | Toolchain check |
| --- | --- | --- | --- |
| Arch desktop (native Linux) | `npm run tauri dev` | `npm run tauri build -- --no-bundle` | `node --test scripts/verify-toolchain.test.mjs` |
| Windows 11 laptop (edit in WSL) | `./scripts/wdev.sh` | `./scripts/wdev.sh build` | `PS> powershell -ExecutionPolicy Bypass -File scripts\verify.ps1` |
| Android (phone, from Arch) | see [BUILD_AND_RUN_ANDROID.md](BUILD_AND_RUN_ANDROID.md) | `npm run tauri android build -- --debug --apk --target aarch64 --target armv7` | `npm run tauri info` |

`src-tauri/target/`, `node_modules/` and `.env` are per machine, never shared or committed.

## Linux native (Arch desktop)

One-time setup:

```
sudo pacman -S --needed rustup webkit2gtk-4.1 libsoup3 base-devel openssl librsvg
rustup default stable
cp .env.example .env        # then fill in TMDB_API_KEY and RAWG_API_KEY
npm ci                      # not `npm install`: keeps the shared lockfile unchanged
node --test scripts/verify-toolchain.test.mjs   # expect: # pass 8, # skipped 3
```

- `npm run tauri build -- --no-bundle` → `src-tauri/target/release/aevum`. No .deb/AppImage; run the binary directly.
- Web Inspector: right-click → Inspect Element, or auto-open it with `env TAURI_APP_DEVTOOLS=1 npm run tauri dev`.
- Wayland: only if the window is blank/white, or a *detached* inspector is solid black, add
  `WEBKIT_DISABLE_DMABUF_RENDERER=1` (e.g. `env WEBKIT_DISABLE_DMABUF_RENDERER=1 TAURI_APP_DEVTOOLS=1 npm run tauri dev`).
  It switches WebKitGTK to software compositing, so expect visible lag; don't leave it on.
  (last resort: add `GDK_BACKEND=x11`).

## Windows laptop (WSL → Windows)

Edit code in WSL. Build and run on Windows. One shared NTFS working tree, no sync step.

## Why Windows-native and not WSL-native

|                | Windows (MSVC + WebView2)                | WSL (GTK + WebKitGTK via WSLg)          |
| -------------- | ---------------------------------------- | --------------------------------------- |
| Rust toolchain | installed (`stable-x86_64-pc-windows-msvc`) | not installed                        |
| Webview deps   | WebView2 runtime installed               | `webkit2gtk-4.1`, `libsoup3` not installed |
| GPU            | native D3D acceleration                  | `/dev/dri` absent -> software GL over RDP |
| File watching  | native NTFS (fast)                       | DrvFs/9p bridge (slow `stat` storms)    |
| Target dir     | 5.6 GB, already warm                     | a second 5.6 GB tree                    |

WSLg with no `/dev/dri` renders the webview in software and composites it over RDP. That is the source of
the stutter this setup avoids. The Windows toolchain already produced a working binary
(`src-tauri/target/debug/aevum.exe`), so it is the supported path.

## One-time prerequisites (Windows side)

- Visual Studio Build Tools with the **Desktop development with C++** workload
  (`C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools`, MSVC 14.50.35717).
- Rust via rustup, host triple `x86_64-pc-windows-msvc` (cargo/rustc 1.93.1).
- Node.js (`C:\Program Files\nodejs`, currently v22.15.1).
- Microsoft Edge WebView2 Runtime (already present, 153.x).
- A repo-root `.env` containing `TMDB_API_KEY` and `RAWG_API_KEY`.
  `src-tauri/build.rs` reads `../.env` and re-exports each key via `cargo:rustc-env`.

Verify all of it at once:

```
PS> powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
```

## Daily workflow

| Task                    | Where         | Command                                       |
| ----------------------- | ------------- | --------------------------------------------- |
| Edit, git, review       | WSL           | your editor                                   |
| TypeScript/Svelte check | WSL           | `npm run check`                               |
| Run the app             | WSL → Windows | `./scripts/wdev.sh`                           |
| Release bundles         | WSL → Windows | `./scripts/wdev.sh build`                     |
| Rust typecheck          | WSL           | `cd src-tauri && cargo.exe check --locked`    |

## Performance notes

- `src-tauri/Cargo.toml` sets `[profile.dev.package."*"] opt-level = 3`. Dependencies are optimised while
  our own crate stays debuggable. This removes dev-mode UI stutter; the cost is one long first build.
- Measured baselines on this machine (22 threads, warm NTFS target dir):
  - one-time full dependency rebuild after the profile change: **5m 18s**
  - warm incremental rebuild after touching `src-tauri/src/lib.rs`: **7.68s**
- `[profile.dev] debug = 1` + `codegen-units = 256` + `/INCREMENTAL` keep relinks of the ~20 MB debug
  binary fast.
- `src-tauri/.cargo/config.toml` pins `target-dir = "target"`. **Do not** move it to a WSL ext4 path —
  `cargo.exe` would then write across the 9p bridge and rebuilds would get slower, not faster.
- Vite dev server: port **1420**, `strictPort: true`. If startup fails with `Port 1420 is already in use`,
  a previous run is still alive: `PS> Get-NetTCPConnection -LocalPort 1420 | Select-Object OwningProcess`.
- `.wslconfig` uses `networkingMode=mirrored`, so `http://localhost:1420` resolves identically from both
  sides. Keep it that way; NAT mode would break cross-side access to the dev server.

## node_modules is shared between two Node versions

WSL runs Node 24 (mise); Windows runs Node 22.15.1. They share one `node_modules`, which currently holds
both `@esbuild/{linux-x64,win32-x64}` and both `@rollup` platform packages.

Rule: **install dependencies from Windows** (`PS> npm install`). If a WSL-side install ever prunes the
Windows optional binaries, the symptom is `Cannot find module @rollup/rollup-win32-x64-msvc`. Recovery:

```
PS> Remove-Item -Recurse -Force node_modules
PS> npm install
```

## Android

Setup, the phone dev loop with hot reload, screen mirroring, sideload APKs and troubleshooting: [BUILD_AND_RUN_ANDROID.md](BUILD_AND_RUN_ANDROID.md).

## WSLg fallback (only if you must run a Linux build)

Not supported by these scripts, and expect software rendering. It requires:

```
WSL$ sudo pacman -S --needed webkit2gtk-4.1 libsoup3 base-devel curl wget file openssl \
       appmenu-gtk-module libappindicator-gtk3 librsvg
WSL$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
WSL$ WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
```

`WEBKIT_DISABLE_COMPOSITING_MODE=1` is required under WSLg or the window renders black. Use this only for
verifying Linux-specific behaviour, never for day-to-day development on this machine.

## Troubleshooting

| Symptom                                      | Cause                        | Fix                                              |
| -------------------------------------------- | ---------------------------- | ------------------------------------------------ |
| `link.exe not found`                         | MSVC env not loaded          | use `scripts/dev.ps1`, which runs `vcvars64.bat` |
| `error: linker 'cc' not found`               | Linux cargo invoked          | use `cargo.exe`, not `cargo`                     |
| Black app window                             | WSLg software rendering      | build on Windows instead                         |
| `Port 1420 is already in use`                | stale Vite process           | kill the owning PID (see above)                  |
| `Cannot find module @rollup/rollup-win32-x64-msvc` | cross-platform npm prune | reinstall from Windows                       |
| Blank media grid, 401s                       | `.env` keys missing at compile time | confirm `.env`, then rebuild (`build.rs` bakes them in) |
| `bad interpreter: /usr/bin/env: 'bash\r'`    | script checked out with CRLF | `.gitattributes` forces LF; re-checkout: `git checkout -- scripts/wdev.sh` |
| Blank/white window on Arch (Wayland)         | WebKitGTK DMA-BUF renderer   | `env WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev` |
| Dev window laggy / posters missing (Arch)    | software compositing forced or inspector docked | drop `WEBKIT_DISABLE_DMABUF_RENDERER`; close the inspector; don't run `npm run verify`/`check` while `tauri dev` is open (each `svelte-kit sync` reloads the app) |
| `TMDB_API_KEY not defined at compile time`   | no `.env` on this machine    | `cp .env.example .env`, fill in keys, rebuild    |
