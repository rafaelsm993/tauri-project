# Releasing SESH

How to cut a release build. This covers **Windows** (NSIS + MSI installers), **Android**
(a signed APK) and **Linux** (a local x86_64 Flatpak). AppImage, deb/rpm publication and Flathub
are not part of this release. Build the Flatpak inside the GNOME SDK, not against Arch's glibc.

## What a release contains

| OS | File | Built by |
|---|---|---|
| Windows | `SESH_x.y.z_x64-setup.exe` (NSIS, recommended), `SESH_x.y.z_x64_en-US.msi` | `./scripts/wdev.sh build` on the Windows laptop |
| Android | `SESH.apk` (arm64 + armv7, signed; Gradle's `app-universal-release.apk` remains beside it) | `./scripts/wdev.sh android release` on the Windows laptop |
| Linux | `SESH_x.y.z_x86_64.flatpak` | `bash scripts/flatpak.sh` on Linux |

## Version bump

Change `version` in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`
together (`scripts/release-config.test.mjs` fails if they differ), run `cargo update -p sesh` in
`src-tauri` so `Cargo.lock` follows, and move `CHANGELOG.md`'s `[Unreleased]` items under
`## [x.y.z] - YYYY-MM-DD`. Android's `versionCode` is derived from the version
(`major*1000000 + minor*1000 + patch`), so every release needs a higher version.

## API keys

Release builds always compile with blank TMDB and RAWG keys, regardless of `.env` or inherited
build-environment values. This includes personal releases; enter each key locally in Settings →
Keys after installing. At runtime the environment variable wins, then the saved key, then a
compiled key. Debug/development builds may embed `.env` keys and must not be shared. Backups
exclude saved keys.

## Windows

```
./scripts/wdev.sh build
```

The first release build takes several minutes (thin LTO, one codegen unit). Output:

- `src-tauri/target/release/bundle/nsis/SESH_x.y.z_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/SESH_x.y.z_x64_en-US.msi`

The NSIS installer installs for the current user (no admin prompt) and embeds the WebView2
bootstrapper. The MSI needs the VBSCRIPT optional Windows feature to build. The installers are not
code-signed, so SmartScreen shows "unknown publisher": More info → Run anyway. Data lives in
`%APPDATA%\com.rafaelsm993.sesh` and survives uninstalling.

## Android signing (once per machine)

1. Create the upload key; you type the passwords, nothing stores them in the repo:

   ```
   & "$env:JAVA_HOME\bin\keytool.exe" -genkey -v -keystore $env:USERPROFILE\.android\sesh-upload.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. Create `src-tauri/gen/android/keystore.properties` (gitignored by `gen/android/.gitignore`):

   ```
   password=<the keystore password>
   keyAlias=upload
   storeFile=C:\\Users\\<you>\\.android\\sesh-upload.jks
   ```

3. Back up `sesh-upload.jks` and its password (a password manager plus one offline copy). **Losing
   it means no future APK can update an installed one**: users would have to uninstall, and lose
   their data unless they export a backup first.

Without `keystore.properties` the release signing block in `app/build.gradle.kts` is skipped, so
`android dev` and debug builds (and CI) never need a keystore.

## Android release

```
./scripts/wdev.sh android release
```

The script refuses to start without `keystore.properties`, builds arm64 + armv7, verifies the
signature with `apksigner`, then copies the APK to
`src-tauri/gen/android/app/build/outputs/apk/universal/release/SESH.apk`.
Gradle's `app-universal-release.apk` remains beside it.

Install or update it with `adb install -r <path-to-SESH.apk>`. For a large APK over wireless adb,
`adb push <path-to-SESH.apk> /data/local/tmp/SESH.apk` then
`adb shell pm install -r --user 0 /data/local/tmp/SESH.apk`. An already release-signed install
updates in place with the **same signing certificate**, keeping its data; do not uninstall it.

**Switching from a debug build:** debug and release builds are signed with different keys, so
Android refuses to update one with the other (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Export a
backup first (Settings → Backup → Export), uninstall, install the release APK, then import the
backup and paste your API keys again (backups never include them).

## Linux Flatpak (x86_64)

Install `flatpak` and `flatpak-builder` plus the GNOME 49 SDK and the matching Rust extension:

```bash
flatpak install --user flathub org.gnome.Sdk//49 org.freedesktop.Sdk.Extension.rust-stable//25.08
bash scripts/flatpak.sh
```

The script builds the frontend from the **current working tree**, then archives **tracked HEAD**
for the Rust/backend source (no ignored `.env` or uncommitted Rust changes), compiles the keyless
release inside the GNOME SDK, and writes `dist/SESH_0.1.0_x86_64.flatpak`. Commit intended Rust
changes before packaging; uncommitted frontend changes are included in the generated `build/`.
The build sandbox needs network access to fetch the
locked Cargo dependencies; this is a local bundle workflow, not a Flathub submission.

Install the bundle with `flatpak install --user ./dist/SESH_0.1.0_x86_64.flatpak` and launch with
`flatpak run com.rafaelsm993.sesh` in a desktop session. Flatpak stores app data separately from
the native Linux install, under `~/.var/app/com.rafaelsm993.sesh/`; use Settings → Backup to move
your library, then re-enter keys. The GNOME 49 runtime must be available on the target machine
(Flatpak prompts to fetch it). A headless terminal cannot verify the graphical UI.

## Smoke test (every OS)

1. Install, then launch: a fresh install shows Welcome.
2. Settings → Keys: paste the keys; Home loads Movies with posters.
3. Add an item; restart the app; it is still there.
4. Settings → Backup → Export writes a zip.
5. On Android, switch to the light theme: the status bar icons turn dark (the `SeshSystemBars`
   bridge survived minification).
6. Restart and confirm the library and saved key still work. Do not uninstall to smoke-test persistence.
