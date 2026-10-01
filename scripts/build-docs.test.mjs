// Guards the build-and-run docs: Android has its own runbook, every entry point links it, and the verified dev loop stays documented.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ANDROID = "docs/BUILD_AND_RUN_ANDROID.md";
const read = (p) => readFileSync(join(root, p), "utf8");

test("the Android runbook exists", () => {
  assert.ok(existsSync(join(root, ANDROID)), `${ANDROID} missing`);
});

test("every entry point links the Android runbook", () => {
  const links = {
    "docs/BUILD_AND_RUN.md": "](BUILD_AND_RUN_ANDROID.md)",
    "README.md": "](docs/BUILD_AND_RUN_ANDROID.md)",
    "AGENTS.md": "docs/BUILD_AND_RUN_ANDROID.md",
    "docs/notes/Config and Stack.md": "](../BUILD_AND_RUN_ANDROID.md)",
    "docs/notes/README.md": "](../BUILD_AND_RUN_ANDROID.md)",
  };
  for (const [file, link] of Object.entries(links)) {
    assert.ok(read(file).includes(link), `${file} does not link ${link}`);
  }
});

test("the runbook keeps the verified phone dev loop", () => {
  const doc = read(ANDROID);
  for (const s of [
    "adb pair",
    "adb reverse tcp:1420 tcp:1420",
    "adb reverse tcp:1421 tcp:1421",
    "npm run tauri android dev -- --host 127.0.0.1",
    "scrcpy",
    "--target aarch64 --target armv7",
    "## Verified",
  ]) {
    assert.ok(doc.includes(s), `${ANDROID} lost "${s}"`);
  }
});

test("the Android dev loop is documented once, not duplicated in BUILD_AND_RUN.md", () => {
  assert.ok(
    !read("docs/BUILD_AND_RUN.md").includes("--host 127.0.0.1"),
    "BUILD_AND_RUN.md repeats the Android dev loop; link the runbook instead",
  );
});

test("the runbook covers the Windows laptop and its known traps", () => {
  const doc = read(ANDROID);
  for (const s of [
    "## Windows laptop",
    "wdev.sh android dev",
    "wdev.sh android build",
    "Developer Mode",
    "class file major version",
    "ADB=",
  ]) {
    assert.ok(doc.includes(s), `${ANDROID} lacks "${s}"`);
  }
});

test("the workflow asks for a phone check on UI changes", () => {
  assert.match(read("AGENTS.md"), /physical Android phone/);
});

// Backup files go through tauri-plugin-fs from Rust only; the WebView must not get fs access.
test("no capability grants the WebView file-system access", () => {
  const dir = join(root, "src-tauri/capabilities");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    assert.ok(
      !read(`src-tauri/capabilities/${f}`).includes('"fs:'),
      `${f} grants an fs: permission`,
    );
  }
});
