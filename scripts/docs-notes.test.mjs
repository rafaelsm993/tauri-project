// Guards docs/notes/ against drifting back to the removed auth/watchlist/cloud layer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const NOTES = "docs/notes";
const read = (p) => readFileSync(join(root, p), "utf8");

const ALL = [
  "Architecture.md",
  "API Reference.md",
  "Component Patterns.md",
  "Front-end/SvelteKit Special Pages.md",
  "Config and Stack.md",
  "Design System.md",
];

test("all current notes exist, legacy ones do not", () => {
  for (const f of ALL) {
    assert.ok(existsSync(join(root, NOTES, f)), `${NOTES}/${f} missing`);
  }
  for (const f of ["Cloud Server.md", "Learning roadmap.md"]) {
    assert.ok(!existsSync(join(root, NOTES, f)), `${f} is legacy`);
  }
});

test("index links every note", () => {
  const index = read(`${NOTES}/README.md`);
  for (const f of ALL) {
    assert.ok(index.includes(`](${encodeURI(f)})`), `index does not link ${f}`);
  }
});

test("notes do not describe removed features", () => {
  const banned = [
    "UserButton",
    "WatchlistButton",
    "userStore",
    "CloudAPI",
    "AuthAPI",
    "WatchlistAPI",
    "rusqlite",
    "DbConn",
    "tauri-app_server",
    "VITE_CLOUD_API_URL",
    "auth_login",
    "/watchlist",
    "/auth",
    "vscode-file://",
  ];
  for (const f of ALL) {
    const body = read(`${NOTES}/${f}`);
    for (const s of banned) {
      assert.ok(!body.includes(s), `${f} mentions removed "${s}"`);
    }
  }
});

test("API Reference documents every registered command", () => {
  const handler = read("src-tauri/src/lib.rs").match(/generate_handler!\[([^\]]*)\]/)?.[1] ?? "";
  const cmds = [...handler.matchAll(/api::\w+::(\w+)/g)].map((m) => m[1]);
  assert.ok(cmds.length > 0, "no commands parsed from lib.rs");
  const ref = read(`${NOTES}/API Reference.md`);
  for (const c of cmds) {
    assert.ok(ref.includes(`\`${c}\``), `API Reference missing ${c}`);
  }
});

test("repo file paths cited in notes exist", () => {
  const pathRe = /`((?:src|src-tauri|scripts)\/[^`\s<>*]+\.[a-z]+)`/g;
  for (const f of ALL) {
    for (const [, p] of read(`${NOTES}/${f}`).matchAll(pathRe)) {
      assert.ok(existsSync(join(root, p)), `${f} cites missing ${p}`);
    }
  }
});

// Patterns removed by S1 (A2 typed facade, A4 runtime tokens, A7 deleted review).
const STALE = [
  "$color-",
  "--clr-gold",
  "glow-gold",
  "serde_json::Value",
  "TauriFlix",
  "PROJECT_REVIEW",
];

test("docs and agent prompts do not teach removed patterns", () => {
  const files = [
    ...ALL.map((f) => `${NOTES}/${f}`),
    `${NOTES}/README.md`,
    "README.md",
    "CHANGELOG.md",
    ".github/instructions/scss-autoinjection.instructions.md",
    ".github/prompts/scaffold-api.prompt.md",
  ];
  const hits = files.flatMap((f) =>
    STALE.filter((s) => read(f).includes(s)).map((s) => `${f} mentions "${s}"`),
  );
  assert.deepEqual(hits, []);
});

test("README links the notes index", () => {
  assert.ok(read("README.md").includes("](docs/notes/README.md)"));
});
