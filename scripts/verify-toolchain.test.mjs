// Verifies build prerequisites; Windows-only and Linux-only checks skip on the other OS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(repoRoot, p), "utf8");
const has = (p) => existsSync(join(repoRoot, p));
const WIN = process.platform === "win32";
const LINUX = process.platform === "linux";
const CI = !!process.env.CI;

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

test("cargo is reachable and reports a stable version", () => {
  const out = run("cargo", ["--version"]);
  assert.match(out, /^cargo \d+\.\d+\.\d+/, `unexpected cargo version line: ${out}`);
});

// CI has no .env; build.rs reads the same keys from the environment there.
test(".env supplies the compile-time API keys build.rs expects", { skip: CI }, () => {
  assert.ok(has(".env"), ".env is missing at the repo root (copy .env.example)");
  const env = read(".env");
  for (const key of ["TMDB_API_KEY", "RAWG_API_KEY"]) {
    assert.match(env, new RegExp(`^${key}=.+$`, "m"), `.env has no non-empty ${key}`);
  }
});

test("the compile-time API keys reach build.rs on CI", { skip: !CI }, () => {
  for (const key of ["TMDB_API_KEY", "RAWG_API_KEY"]) {
    assert.ok(process.env[key], `${key} is not set in the CI environment`);
  }
});

test("the Tauri CLI native binary for this platform is installed", () => {
  const pkg = WIN ? "@tauri-apps/cli-win32-x64-msvc" : "@tauri-apps/cli-linux-x64-gnu";
  assert.ok(
    has(`node_modules/${pkg}`),
    `node_modules/${pkg} missing — install dependencies on this machine`,
  );
});

test("cargo dev profile is tuned for fast links and smooth runtime", () => {
  assert.ok(has("src-tauri/.cargo/config.toml"), "src-tauri/.cargo/config.toml is missing");
  const cargoToml = read("src-tauri/Cargo.toml");
  assert.match(cargoToml, /\[profile\.dev\]/, "Cargo.toml has no [profile.dev] section");
  assert.match(
    cargoToml,
    /\[profile\.dev\.package\."\*"\]\s*\nopt-level = 3/,
    "dependencies are not optimised in the dev profile (causes UI stutter)",
  );
  assert.match(cargoToml, /\[profile\.release\]/, "Cargo.toml has no [profile.release] section");
});

test("the Windows launcher scripts exist", () => {
  for (const f of ["scripts/dev.ps1", "scripts/build.ps1", "scripts/wdev.sh"]) {
    assert.ok(has(f), `${f} is missing`);
  }
});

test("the build/run runbook covers both machines", () => {
  assert.ok(has("docs/BUILD_AND_RUN.md"), "docs/BUILD_AND_RUN.md is missing");
  const doc = read("docs/BUILD_AND_RUN.md");
  assert.match(doc, /x86_64-pc-windows-msvc/, "runbook does not name the MSVC target");
  assert.match(doc, /WSLg/, "runbook does not discuss the WSLg fallback");
  assert.match(doc, /## Linux native/, "runbook has no Linux-native section");
});

test("the active rust toolchain targets x86_64-pc-windows-msvc", { skip: !WIN }, () => {
  const out = run("rustc", ["-vV"]);
  assert.match(out, /host: x86_64-pc-windows-msvc/, `rustc is not MSVC-hosted:\n${out}`);
});

test("the MSVC linker is on PATH", { skip: !WIN }, () => {
  const out = run("cmd", ["/c", "where", "link.exe"]);
  assert.match(out, /link\.exe/i, `link.exe not found on PATH:\n${out}`);
});

test("a WebView2 runtime is installed", { skip: !WIN }, () => {
  const base = "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application";
  assert.ok(existsSync(base), `WebView2 runtime directory missing: ${base}`);
});

test("the active rust toolchain targets x86_64-unknown-linux-gnu", { skip: !LINUX }, () => {
  const out = run("rustc", ["-vV"]);
  assert.match(out, /host: x86_64-unknown-linux-gnu/, `rustc is not linux-gnu-hosted:\n${out}`);
});

test("WebKitGTK 4.1 stack is visible to pkg-config", { skip: !LINUX }, () => {
  for (const mod of ["webkit2gtk-4.1", "javascriptcoregtk-4.1", "libsoup-3.0", "gtk+-3.0"]) {
    assert.doesNotThrow(
      () => run("pkg-config", ["--exists", mod]),
      `pkg-config cannot find ${mod}`,
    );
  }
});
