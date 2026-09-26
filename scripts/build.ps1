# scripts/build.ps1
# Produces a release build and Windows bundles (MSI + NSIS) for Aevum.
# Usage (from Windows PowerShell, repo root):
#   PS> powershell -ExecutionPolicy Bypass -File scripts\build.ps1
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$vsWhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vsWhere)) { throw "vswhere.exe not found. Install Visual Studio Build Tools." }

$vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) { throw "No VC++ build tools found. Install the 'Desktop development with C++' workload." }

$vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
cmd /c "`"$vcvars`" >nul && set" | ForEach-Object {
  if ($_ -match "^([^=]+)=(.*)$") { Set-Item -Path "Env:$($matches[1])" -Value $matches[2] }
}

$env:PATH = "$env:USERPROFILE\.cargo\bin;C:\Program Files\nodejs;$env:PATH"

if (-not (Test-Path ".env")) { throw ".env is missing; build.rs needs TMDB_API_KEY and RAWG_API_KEY." }

# Call the Tauri CLI directly. The npm .cmd shim on Windows mangles the
# forwarded --bundles argument and leaks it to cargo instead.
node node_modules\@tauri-apps\cli\tauri.js build --bundles msi,nsis
if ($LASTEXITCODE -ne 0) { throw "tauri build failed with exit code $LASTEXITCODE" }
Write-Host "Bundles written to src-tauri\target\release\bundle\"
