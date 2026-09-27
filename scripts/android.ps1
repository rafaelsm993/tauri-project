# scripts/android.ps1
# Runs the Android dev loop or a debug APK build on Windows, with JDK 17, the SDK and MSVC loaded.
# Usage (from Windows PowerShell, repo root, or `./scripts/wdev.sh android dev|build` from WSL):
#   PS> powershell -ExecutionPolicy Bypass -File scripts\android.ps1 dev    # hot reload on the phone
#   PS> powershell -ExecutionPolicy Bypass -File scripts\android.ps1 build  # arm64 debug APK
param([ValidateSet("dev", "build")][string]$Mode = "dev")
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# New shells may not see these yet; the JDK installer sets JAVA_HOME machine-wide.
foreach ($name in "ANDROID_HOME", "NDK_HOME", "JAVA_HOME") {
  $value = [Environment]::GetEnvironmentVariable($name, "User")
  if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, "Machine") }
  if (-not $value) { throw "$name is not set. See docs/BUILD_AND_RUN_ANDROID.md (Windows laptop)." }
  Set-Item "Env:$name" $value.TrimEnd("\")
}

$vsWhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vsWhere)) { throw "vswhere.exe not found. Install Visual Studio Build Tools." }
$vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
$vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
cmd /c "`"$vcvars`" >nul && set" | ForEach-Object {
  if ($_ -match "^([^=]+)=(.*)$") { Set-Item -Path "Env:$($matches[1])" -Value $matches[2] }
}

# The SDK's adb first: a second adb (scrcpy bundles one) drops the phone's connection.
$platformTools = Join-Path $env:ANDROID_HOME "platform-tools"
$env:ADB = Join-Path $platformTools "adb.exe"
$env:PATH = "$platformTools;$env:JAVA_HOME\bin;$env:USERPROFILE\.cargo\bin;C:\Program Files\nodejs;$env:PATH"

if ($Mode -eq "build") {
  Write-Host "Building the arm64 debug APK ..."
  cmd /c "npm run tauri android build -- --debug --apk --target aarch64"
  if ($LASTEXITCODE -ne 0) { throw "android build failed with exit code $LASTEXITCODE" }
  Write-Host "APK: src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk"
  exit 0
}

$devices = @(& $env:ADB devices | Select-String "\tdevice$")
if ($devices.Count -ne 1) {
  throw "Expected exactly one phone in 'adb devices', found $($devices.Count). Connect it first (adb connect <ip:port>)."
}
cmd /c "adb reverse tcp:1420 tcp:1420 && adb reverse tcp:1421 tcp:1421"
if ($LASTEXITCODE -ne 0) { throw "adb reverse failed with exit code $LASTEXITCODE" }
cmd /c "npm run tauri android dev -- --host 127.0.0.1"
if ($LASTEXITCODE -ne 0) { throw "android dev failed with exit code $LASTEXITCODE" }
