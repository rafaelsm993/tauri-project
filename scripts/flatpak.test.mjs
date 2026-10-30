import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = readFileSync("flatpak/com.rafaelsm993.sesh.yml", "utf8");
const script = readFileSync("scripts/flatpak.sh", "utf8");

test("Flatpak builds SESH from a clean source archive in the GNOME SDK", () => {
  assert.match(manifest, /^id: com\.rafaelsm993\.sesh$/m);
  assert.match(manifest, /^runtime: org\.gnome\.Platform$/m);
  assert.match(manifest, /^sdk: org\.gnome\.Sdk$/m);
  assert.match(manifest, /org\.freedesktop\.Sdk\.Extension\.rust-stable/);
  assert.match(manifest, /cargo build --release --locked --features tauri\/custom-protocol/);
  assert.match(script, /git archive HEAD/);
  assert.match(script, /cp -a build/);
  assert.match(script, /flatpak build-bundle/);
});

test("Flatpak requests only required desktop and media permissions", () => {
  assert.match(manifest, /--share=network/);
  assert.match(manifest, /--socket=wayland/);
  assert.match(manifest, /--socket=fallback-x11/);
  assert.match(manifest, /--socket=pulseaudio/);
  assert.doesNotMatch(manifest, /--filesystem=(host|home)/);
  assert.doesNotMatch(manifest, /--socket=session-bus/);
  assert.match(script, /flatpak-builder --user --force-clean --state-dir=/);
});
