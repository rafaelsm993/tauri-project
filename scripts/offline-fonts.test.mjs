// Guard: the UI fonts ship in the bundle so the app looks the same offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("global.css fetches nothing from the network", () => {
  const css = read("src/lib/styles/global.css");
  assert.doesNotMatch(css, /@import\s+url\(\s*["']?https?:/);
  assert.ok(!css.includes("fonts.googleapis.com"));
});

test("the layout imports all three bundled families", () => {
  const layout = read("src/routes/+layout.svelte");
  for (const pkg of [
    "@fontsource/bebas-neue",
    "@fontsource-variable/dm-sans",
    "@fontsource/dm-mono",
  ]) {
    assert.ok(layout.includes(`import "${pkg}`), `${pkg} is not imported`);
  }
});

test("the body font token names the bundled family", () => {
  const tokens = read("src/lib/styles/variables.scss") + read("src/lib/styles/global.css");
  assert.ok(tokens.includes('"DM Sans Variable"'));
});
