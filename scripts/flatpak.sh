#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
version=$(node -p 'require("./package.json").version')
stage=$(mktemp -d "${TMPDIR:-/tmp}/sesh-flatpak.XXXXXX")
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/source" dist

npm run build
git archive HEAD | tar -x -C "$stage/source"
cp -a build "$stage/source/build"
cp flatpak/com.rafaelsm993.sesh.* "$stage/"
cp flatpak/com.rafaelsm993.sesh.yml "$stage/manifest.yml"

flatpak-builder --user --force-clean --state-dir="$stage/state" --repo="$stage/repo" "$stage/work" "$stage/manifest.yml"
flatpak build-bundle "$stage/repo" "dist/SESH_${version}_x86_64.flatpak" com.rafaelsm993.sesh
printf 'Built %s\n' "$(realpath "dist/SESH_${version}_x86_64.flatpak")"
