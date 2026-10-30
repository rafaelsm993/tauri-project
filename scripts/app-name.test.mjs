// Guards the app name: SESH everywhere; the old name survives only in the changelog history and the legacy title mapping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ALLOWED = new Set([
  "CHANGELOG.md",
  "scripts/app-name.test.mjs",
  "src/lib/domain/titles.ts",
  "src/lib/domain/titles.test.ts",
  "src/lib/stores/prefs.test.ts",
]);
const TEXT =
  /\.(ts|js|mjs|svelte|rs|json|toml|lock|md|yml|yaml|html|css|scss|kt|kts|xml|ps1|sh|pro|gradle)$/;
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f && TEXT.test(f) && !ALLOWED.has(f) && existsSync(f));

test("the old name is gone from tracked files", () => {
  const hits = tracked.filter((f) => /aevum/i.test(readFileSync(f, "utf8")));
  assert.deepEqual(hits, []);
});

test("product, binary, window and identifier agree", () => {
  const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  assert.equal(conf.productName, "SESH");
  assert.equal(conf.mainBinaryName, "sesh");
  assert.equal(conf.identifier, "com.rafaelsm993.sesh");
  assert.equal(conf.app.windows[0].title, "SESH");
  const gradle = readFileSync("src-tauri/gen/android/app/build.gradle.kts", "utf8");
  assert.match(gradle, /namespace = "com\.rafaelsm993\.sesh"/);
  assert.match(gradle, /applicationId = "com\.rafaelsm993\.sesh"/);
  assert.match(readFileSync("src-tauri/Cargo.toml", "utf8"), /^name = "sesh"$/m);
});
