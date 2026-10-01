# Building and running Aevum on Android

Android runs from the Arch desktop and from the Windows laptop (driven from WSL, see [Windows laptop](#windows-laptop)). Develop on a **physical phone over Wireless debugging**: frontend edits hot-reload on the phone in about a second, Rust edits rebuild and reinstall on their own. The emulator does not work on this host (see [Emulator](#emulator)).

| Task | Command |
| --- | --- |
| Run with hot reload | `npm run tauri android dev -- --host 127.0.0.1` (after `adb reverse`, below) |
| Mirror and control the phone | `scrcpy --max-size 1024 --max-fps 60 --stay-awake` |
| APK to sideload | `npm run tauri android build -- --debug --apk --target aarch64 --target armv7` |
| Rust logs | `adb logcat \| grep -E 'tauri\|\[catalog\]\|\[tmdb\]'` |

## Project

The Android Studio project is generated in `src-tauri/gen/android` (committed; build output is ignored by its own `.gitignore`). Regenerate it only with `npm run tauri android init`, never by hand. The package is `com.rafaelsm993.aevum`: Tauri turns the `-` in the placeholder identifier into `_`. It changes, with a one-time re-init, when the app gets its final name.

## One-time setup (Arch)

```
sdkmanager "platform-tools" "platforms;android-35" "build-tools;36.0.0" "ndk;27.3.13750724"
rustup target add aarch64-linux-android armv7-linux-androideabi
# JDK 17 (e.g. jdk17-openjdk) and, in your shell config (fish: set -Ux NAME value):
ANDROID_HOME=$HOME/Android/Sdk
NDK_HOME=$ANDROID_HOME/ndk/27.3.13750724
JAVA_HOME=/usr/lib/jvm/java-17-openjdk
```

Screen mirror: `sudo pacman -S scrcpy`, or without root the static release from github.com/Genymobile/scrcpy (check it against `SHA256SUMS.txt`) unpacked to `~/.local/opt` and linked into `~/.local/bin`.

## Windows laptop

The same phone loop runs on the Windows side of the laptop, started from WSL like the desktop app ([BUILD_AND_RUN.md](BUILD_AND_RUN.md)). No Android Studio.

| Task | Command (WSL, repo root) |
| --- | --- |
| Run with hot reload | `./scripts/wdev.sh android dev` (one phone connected; it runs `adb reverse` itself) |
| APK to sideload (arm64) | `./scripts/wdev.sh android build` |

One-time setup, in Windows PowerShell:

1. Android SDK command-line tools from the SDK index (`https://dl.google.com/android/repository/repository2-3.xml`, `cmdline-tools;latest`, check its SHA-1), unpacked to `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`.
2. Packages: `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\android.exe sdk install platform-tools platforms/android-35 build-tools/36.0.0 ndk/27.3.13750724` (cmdline-tools 23 replaced `sdkmanager` with `android`; it may exit non-zero after installing everything, so check `android sdk list`).
3. `rustup target add aarch64-linux-android armv7-linux-androideabi`, and `winget install --id Genymobile.scrcpy --exact`.
4. User environment: `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, `NDK_HOME=%ANDROID_HOME%\ndk\27.3.13750724`, `ADB=%ANDROID_HOME%\platform-tools\adb.exe`, and `platform-tools` first on PATH. `JAVA_HOME` must be a JDK 17 (it may be set machine-wide; `scripts/android.ps1` reads both scopes).
5. **Developer Mode** on (Settings → System → For developers): Tauri links the Rust library into the Android project with a symbolic link, which Windows only allows in Developer Mode.

Pairing and the daily `adb connect` work as below with `adb` from `platform-tools`. Mirror with `scrcpy --max-size 1024 --max-fps 60 --stay-awake --no-audio`; it uses the SDK adb because `ADB=` is set. The first build compiles every Rust dependency for Android (about 4 minutes on the laptop), the APK step about 3 minutes; later builds only recompile what changed.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Creation symbolic link is not allowed` after the Rust build | Developer Mode is off | turn it on, run again (Rust is cached) |
| Gradle `Unsupported class file major version 69` | Gradle ran on Java 25 from PATH | `JAVA_HOME` must be a JDK 17; use `scripts/android.ps1`, which loads it |
| scrcpy shows an error and "press Enter" | its bundled adb fights the SDK adb that holds the phone | set `ADB=` to the SDK adb, as above |
| Windows lists "Unknown USB Device (Device Descriptor Request Failed)" | charge-only or faulty cable/port | another data cable, or Wireless debugging |

## Pair the phone (once per phone)

1. Phone: Settings → About phone → Software information → tap **Build number** 7 times → Developer options → **Wireless debugging** on. Phone and PC on the same Wi-Fi; turn any phone VPN off while pairing.
2. Tap **Pair device with pairing code** and keep that screen open.
3. PC: `adb pair <phone-LAN-ip>:<pairing-port>` and type the 6-digit code at the prompt (don't paste it into chats or scripts; it is single-use).
4. Expected: `Successfully paired to <ip>:<port>`.

## Daily loop

```
adb connect <phone-LAN-ip>:<port>          # port from the Wireless debugging screen, or `adb mdns services`
adb devices                                # exactly one line for the phone
adb reverse tcp:1420 tcp:1420 && adb reverse tcp:1421 tcp:1421
npm run tauri android dev -- --host 127.0.0.1
```

- `--host 127.0.0.1` + `adb reverse` send the dev server (1420) and HMR (1421) through adb, so the host firewall (UFW) stays closed.
- `adb reverse` is lost when the phone reconnects; run it again after every `adb connect`.
- A USB cable works the same way (skip pairing) if the phone enumerates in `lsusb`.

## Mirror and control

```
ADB=$HOME/Android/Sdk/platform-tools/adb scrcpy --max-size 1024 --max-fps 60 --stay-awake
```

Click = tap, wheel = scroll, right-click = Back, keyboard types into the phone. Setting `ADB` keeps scrcpy on the SDK's adb server. The window closes when the phone locks; unlock it and start scrcpy again. The stream is compressed video: judge performance on the phone itself, not in the mirror.

## APK to sideload

```
npm run tauri android build -- --debug --apk --target aarch64 --target armv7
```

Output: `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` (debug-signed, minSdk 24). Install it with `adb install -r <apk>` or copy it to the phone. It embeds the API keys from your `.env` at compile time, so never share a local build. CI builds an arm64 debug APK with dummy keys and uploads it as the `app-debug-apk` artifact.

## Emulator

Not usable on this host. The emulator's own qemu process (`qemu-system-x86_64`, emulator 37.1.11.0) segfaults 20–30 s after the app's WebView starts, always at the same instruction, on API 35 and API 37.1 x86_64 images and in every GPU mode (`host`, `swiftshader_indirect`, `guest`, `-feature -Vulkan`). The crash is in the emulator binary (`coredumpctl list` shows it), not in the app. Retry only after an emulator update; an x86_64 build is `--target x86_64`.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| WebView shows `chrome-error://`; logcat `custom protocol timed out` | the phone was pointed at the PC's LAN IP; UFW blocks 1420/1421 | `adb reverse` both ports, run with `-- --host 127.0.0.1` |
| Wireless debugging shows `100.64.x.x`; `adb pair` says `protocol fault` | a VPN on the phone | turn the VPN off, pair against the phone's LAN IP |
| `adb devices` lists the phone twice (mDNS name + `ip:port`) | two transports | `adb disconnect <ip:port>`; `tauri android dev` needs exactly one device |
| `tauri android dev <device>` opens Android Studio | the device argument didn't match | run it with no device argument while one device is connected |
| Phone never appears in `lsusb` / kernel `error -71` | charge-only or faulty cable/socket | use Wireless debugging |
| Edit saved but nothing changes on the phone | the edited value is overridden by the caller (e.g. a prop default) | check the Vite log for `hmr update <file>`, then edit the value actually rendered |
| `adb` commands hang | the device went away | wrap scripted calls in `timeout 10 adb …`; reconnect |

## Verified

| Date | Device | Result |
| --- | --- | --- |
| 2026-09-23 | Samsung SM-A346M, Android 16, arm64 (Wireless debugging) | Dev build installs and runs; logcat `[tmdb] discover → 200`; home carousels render; a `.svelte` edit hot-reloads on the phone in ~1 s without reinstall; scrcpy 4.1 mirror and control work; sideloaded debug APK (arm64 + armv7) runs. |
| 2026-09-27 | Samsung SM-A346M, Android 16, arm64, from the Windows laptop (Wireless debugging) | SDK tools 23 + NDK 27.3 without Android Studio; arm64 debug APK builds (Rust 3m42s cold, APK 3.3 min), installs and runs; logcat `[tmdb] → 200`; home carousels render; scrcpy 4.1 mirrors. |
| 2026-09-27 | Samsung SM-A346M, Android 16 (C7b) | Backup across devices: a zip exported by the Windows app imports on the phone through the system picker (preview 4 items · 29 activity records · 4 posters → Replace; posters show, level matches); exporting on the phone to Downloads writes a zip that verifies (8 files, same counts) and leaves no staging file. |
| 2026-09-23 | Emulator 37.1.11.0, API 35 / 37.1 x86_64 | Fails: qemu SIGSEGV when the WebView starts (see [Emulator](#emulator)). |
