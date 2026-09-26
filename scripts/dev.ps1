# scripts/dev.ps1
# Starts Aevum in development mode with the MSVC toolchain on PATH.
# Usage (from Windows PowerShell, repo root):
#   PS> powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$vsWhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vsWhere)) { throw "vswhere.exe not found. Install Visual Studio Build Tools." }

$vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) { throw "No VC++ build tools found. Install the 'Desktop development with C++' workload." }

# Import the MSVC environment into this PowerShell session.
$vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
cmd /c "`"$vcvars`" >nul && set" | ForEach-Object {
  if ($_ -match "^([^=]+)=(.*)$") { Set-Item -Path "Env:$($matches[1])" -Value $matches[2] }
}

$env:PATH = "$env:USERPROFILE\.cargo\bin;C:\Program Files\nodejs;$env:PATH"

Write-Host "cargo : $((cargo --version))"
Write-Host "node  : $((node --version))"
Write-Host "Starting 'npm run tauri dev' ..."
npm run tauri dev
