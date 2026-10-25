// Custom properties must match both ways: every token defined in global.css is used in src/,
// and every --clr-* a component reads is defined (a typo renders as nothing at all).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// Placeholders kept on purpose until the design task picks the family hues (GOALS §6.6).
const KEEP = /^--clr-hue-/;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(`${dir}/${e.name}`)
      : /\.(svelte|ts|scss|css)$/.test(e.name)
        ? [`${dir}/${e.name}`]
        : [],
  );

test("every custom property defined in global.css is used", () => {
  const css = readFileSync("src/lib/styles/global.css", "utf8");
  const defined = [...new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]))];
  const corpus = walk("src")
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  const unused = defined.filter(
    (d) =>
      !KEEP.test(d) &&
      !new RegExp(`var\\(${d}(?![\\w-])|getPropertyValue\\(["']${d}["']\\)`).test(corpus),
  );
  assert.deepEqual(unused, [], "delete unused tokens or use them");
});

test("every --clr-* read in src/ is defined in global.css", () => {
  const css = readFileSync("src/lib/styles/global.css", "utf8");
  const defined = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  const missing = new Set();
  for (const file of walk("src")) {
    if (file.endsWith("styles/global.css")) continue;
    for (const [, token] of readFileSync(file, "utf8").matchAll(/var\((--clr-[\w-]+)/g)) {
      if (!defined.has(token)) missing.add(`${token} (${file})`);
    }
  }
  assert.deepEqual([...missing], [], "undefined color tokens render as nothing");
});
