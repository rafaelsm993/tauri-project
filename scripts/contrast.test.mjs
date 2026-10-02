// Every text/surface pair in the dark and light palettes meets WCAG contrast (GOALS §6.6).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/lib/styles/global.css", "utf8");

// The declarations of the first rule whose selector line matches.
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}

function rgbOf(value, vars) {
  if (value === undefined) throw new Error("missing colour token");
  const ref = value.match(/^rgb\(var\((--[\w-]+)\)\)$/);
  if (ref) return rgbOf(vars[ref[1]], vars);
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const triple = value.match(/^(\d+) (\d+) (\d+)$/);
  if (triple) return [1, 2, 3].map((i) => Number(triple[i]));
  throw new Error(`cannot read colour ${value}`);
}

function luminance([r, g, b]) {
  const ch = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const dark = block(":root");
const PALETTES = { dark, light: { ...dark, ...block(':root[data-theme="light"]') } };
const SURFACES = ["--clr-bg", "--clr-surface", "--clr-surface-2"];

// [foreground, background, minimum ratio]
const PAIRS = [
  ...SURFACES.flatMap((s) => [
    ["--clr-text", s, 4.5],
    ["--clr-text-2", s, 4.5],
    ["--clr-text-3", s, 3],
    ["--clr-primary", s, 3],
    ["--clr-error", s, 3],
    ["--clr-teal", s, 3],
    ["--clr-highlight", s, 3],
  ]),
  ["--clr-on-scrim", "--clr-scrim", 4.5],
  ["--clr-on-primary", "--clr-primary", 3],
  ["--clr-bg", "--clr-primary", 3],
];

for (const [name, vars] of Object.entries(PALETTES)) {
  test(`the ${name} palette meets contrast`, () => {
    const color = (token) => rgbOf(vars[token] ?? `rgb(var(${token}-rgb))`, vars);
    const low = PAIRS.map(([fg, bg, min]) => [fg, bg, min, contrast(color(fg), color(bg))])
      .filter(([, , min, ratio]) => ratio < min)
      .map(([fg, bg, min, ratio]) => `${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`);
    assert.deepEqual(low, []);
  });
}

test("a light palette exists and differs from the dark one", () => {
  assert.notEqual(PALETTES.light["--clr-bg-rgb"], dark["--clr-bg-rgb"]);
});

test("following the system in light mode uses exactly the light palette", () => {
  assert.deepEqual(block(':root[data-theme="system"]'), block(':root[data-theme="light"]'));
});
