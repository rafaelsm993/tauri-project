# scripts/gate.ps1
# Runs an npm script (default: the full `verify` gate) inside the MSVC developer environment.
# Usage (from Windows PowerShell, repo root):
#   PS> powershell -ExecutionPolicy Bypass -File scripts\gate.ps1            # npm run verify
#   PS> powershell -ExecutionPolicy Bypass -File scripts\gate.ps1 verify:rs  # any npm script
param([string]$Script = "verify")
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

Write-Host "node  : $((node --version)) | cargo : $((cargo --version))"
Write-Host "Running 'npm run $Script' ..."
npm run $Script
if ($LASTEXITCODE -ne 0) { throw "npm run $Script failed with exit code $LASTEXITCODE" }
Write-Host "npm run $Script passed."
