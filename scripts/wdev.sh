#!/usr/bin/env bash
# scripts/wdev.sh
# Launches the Windows-native dev build from a WSL shell.
# The app process, Vite, and cargo all run on Windows; WSL only issues the command.
# Usage:  WSL$ ./scripts/wdev.sh                    (dev)
#         WSL$ ./scripts/wdev.sh build              (release bundles)
#         WSL$ ./scripts/wdev.sh gate [npm-script]  (npm run verify, or the given script, on Windows)
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$repo_root" in
  /mnt/[a-z]/*) ;;
  *) echo "error: repo must live on a Windows drive (/mnt/<drive>/...), got: $repo_root" >&2; exit 1 ;;
esac

win_root="$(wslpath -w "$repo_root")"
case "${1:-dev}" in
  build) script="build.ps1" ;;
  gate) script="gate.ps1 ${2:-verify}" ;;
  *) script="dev.ps1" ;;
esac

exec powershell.exe -NoProfile -ExecutionPolicy Bypass \
  -Command "cd '$win_root'; .\\scripts\\$script; exit \$LASTEXITCODE"
