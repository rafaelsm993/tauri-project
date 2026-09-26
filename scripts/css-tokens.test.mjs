// Every custom property defined in global.css must be used somewhere in src/.

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
    (d) => !KEEP.test(d) && !new RegExp(`var\\(${d}(?![\\w-])`).test(corpus),
  );
  assert.deepEqual(unused, [], "delete unused tokens or use them");
});
