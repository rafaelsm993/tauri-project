// Guard: components take colors only from runtime `--clr-*` tokens (GOALS §6.6); opt out per line with `colors: allow`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ALLOW = "colors: allow";
const RULES = [
  { name: "SCSS color variable", re: /\$color-[\w-]+/ },
  { name: "hex color", re: /(?<![\w&])#[0-9a-fA-F]{3,8}\b(?![\w-])/ },
  { name: "numeric rgb()/hsl()", re: /\b(?:rgba?|hsla?)\(\s*[\d.]/ },
  {
    name: "SCSS color function",
    re: /\b(?:rgba|darken|lighten|mix|transparentize|fade-out|fade-in)\(\s*\$/,
  },
];

function walk(dir, out = []) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (entry.endsWith(".svelte")) out.push(rel);
  }
  return out;
}

// Returns `file:line: rule` for every color literal in the given .svelte sources.
export function findColorLiterals(files) {
  const hits = [];
  for (const [file, text] of files) {
    text.split("\n").forEach((line, i) => {
      if (line.includes(ALLOW)) return;
      for (const { name, re } of RULES) {
        if (re.test(line)) {
          hits.push(`${file}:${i + 1}: ${name}: ${line.trim()}`);
          break;
        }
      }
    });
  }
  return hits;
}

test("rules catch every literal form and ignore tokens", () => {
  const bad = [
    "color: $color-primary;",
    "background: rgba($color-primary, 0.2);",
    "color: #ff5263;",
    "color: #fff;",
    "border: 1px solid rgba(255, 255, 255, 0.1);",
    "background: rgb(8 11 16);",
    "color: darken($x, 10%);",
  ];
  const good = [
    "color: var(--clr-primary);",
    "background: rgb(var(--clr-primary-rgb) / 0.12);",
    'href="#main"',
    "{#each items as item (item.media_key)}",
    "&#8230;",
    "color: #fff; // colors: allow",
  ];
  assert.equal(findColorLiterals(bad.map((l, i) => [`bad${i}`, l])).length, bad.length);
  assert.deepEqual(findColorLiterals(good.map((l, i) => [`good${i}`, l])), []);
});

test("components use only --clr-* tokens", () => {
  const files = walk("src").map((f) => [f, readFileSync(join(root, f), "utf8")]);
  const hits = findColorLiterals(files);
  assert.equal(hits.length, 0, `${hits.length} color literal(s):\n${hits.join("\n")}`);
});
