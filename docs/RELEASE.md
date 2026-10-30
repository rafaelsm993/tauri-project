# Releasing SESH

How to cut a release build. Today this covers **Windows** (NSIS + MSI installers) and **Android**
(a signed APK). Linux packages and the Flatpak come later, built on ubuntu-22.04 (an Arch-built
AppImage links a newer glibc than most users have).

## What a release contains

| OS | File | Built by |
|---|---|---|
| Windows | `SESH_x.y.z_x64-setup.exe` (NSIS, recommended), `SESH_x.y.z_x64_en-US.msi` | `./scripts/wdev.sh build` on the Windows laptop |
| Android | `app-universal-release.apk` (arm64 + armv7, signed) | `./scripts/wdev.sh android release` on the Windows laptop |

## Version bump

Change `version` in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`
together (`scripts/release-config.test.mjs` fails if they differ), run `cargo update -p sesh` in
`src-tauri` so `Cargo.lock` follows, and move `CHANGELOG.md`'s `[Unreleased]` items under
`## [x.y.z] - YYYY-MM-DD`. Android's `versionCode` is derived from the version
(`major*1000000 + minor*1000 + patch`), so every release needs a higher version.

## API keys

`src-tauri/build.rs` bakes `TMDB_API_KEY` and `RAWG_API_KEY` from `.env` into the binary, and
`keys::resolve` prefers, in order, the runtime environment variable, the key saved in Settings →
Keys, then the compiled key. So:

- A build made with your `.env` keys is for **your own devices only**. Anyone can pull compiled keys
  out of a binary with `strings`.
- A build for other people is made **without** keys (no `.env`, or empty values); the app then asks
  for them in Settings → Keys.

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

The script refuses to start without `keystore.properties`, builds arm64 + armv7, and prints
`apksigner verify --print-certs` for the result:
`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`.

Install it with `adb install -r <apk>` (for a large APK over wireless adb, `adb push` it to
`/data/local/tmp/` and run `adb shell pm install --user 0 /data/local/tmp/<apk>`).

**Switching from a debug build:** debug and release builds are signed with different keys, so
Android refuses to update one with the other (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Export a
backup first (Settings → Backup → Export), uninstall, install the release APK, then import the
backup and paste your API keys again (backups never include them).

## Smoke test (every OS)

1. Install, then launch: a fresh install shows Welcome.
2. Settings → Keys: paste the keys; Home loads Movies with posters.
3. Add an item; restart the app; it is still there.
4. Settings → Backup → Export writes a zip.
5. On Android, switch to the light theme: the status bar icons turn dark (the `SeshSystemBars`
   bridge survived minification).
6. Uninstall.
