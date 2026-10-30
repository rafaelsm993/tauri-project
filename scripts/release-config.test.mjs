// Guards the release setup: pinned bundles, one version, and Android signing that never breaks dev builds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("release builds erase compiled provider keys even with a dotenv file and inherited keys", () => {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "sesh-keyless-"));
  try {
    mkdirSync(join(dir, "src-tauri"));
    writeFileSync(
      join(dir, ".env"),
      "TMDB_API_KEY=dotenv-sentinel\nRAWG_API_KEY=dotenv-sentinel\n",
    );
    const source = readFileSync("src-tauri/build.rs", "utf8").replace("tauri_build::build()", "()");
    writeFileSync(join(dir, "probe.rs"), source);
    const binary = join(dir, process.platform === "win32" ? "probe.exe" : "probe");
    execFileSync("rustc", ["--edition=2021", join(dir, "probe.rs"), "-o", binary]);
    const env = {
      ...process.env,
      PROFILE: "release",
      TMDB_API_KEY: "env-sentinel",
      RAWG_API_KEY: "env-sentinel",
    };
    const out = execFileSync(binary, { cwd: join(dir, "src-tauri"), env, encoding: "utf8" });
    assert.doesNotMatch(out, /dotenv-sentinel|env-sentinel/);
    assert.match(out, /^cargo:rustc-env=TMDB_API_KEY=$/m);
    assert.match(out, /^cargo:rustc-env=RAWG_API_KEY=$/m);
    const debug = execFileSync(binary, {
      cwd: join(dir, "src-tauri"),
      env: { ...env, PROFILE: "debug" },
      encoding: "utf8",
    });
    assert.match(debug, /cargo:rustc-env=TMDB_API_KEY=dotenv-sentinel/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const read = (p) => readFileSync(p, "utf8");
const conf = JSON.parse(read("src-tauri/tauri.conf.json"));

test("desktop bundles are pinned per OS", () => {
  assert.deepEqual(conf.bundle.targets, ["nsis", "msi", "appimage", "deb", "rpm"]);
  assert.equal(conf.bundle.windows.webviewInstallMode.type, "embedBootstrapper");
  assert.equal(conf.bundle.windows.nsis.installMode, "currentUser");
  assert.ok(conf.bundle.publisher && conf.bundle.shortDescription && conf.bundle.category);
});

test("the version is one source of truth", () => {
  const pkg = JSON.parse(read("package.json"));
  const cargo = read("src-tauri/Cargo.toml").match(/^version = "(.+)"/m)[1];
  assert.equal(pkg.version, conf.version);
  assert.equal(cargo, conf.version);
});

test("Android release signing is optional, so dev and CI debug builds never need a keystore", () => {
  const gradle = read("src-tauri/gen/android/app/build.gradle.kts");
  assert.match(gradle, /if \(keystorePropertiesFile\.exists\(\)\)/);
  assert.match(gradle, /signingConfigs\.findByName\("release"\)/);
  assert.match(read("src-tauri/gen/android/.gitignore"), /^\/?keystore\.properties$/m);
});

test("minified release builds keep the system bars bridge", () => {
  assert.match(
    read("src-tauri/gen/android/app/proguard-rules.pro"),
    /@android\.webkit\.JavascriptInterface <methods>;/,
  );
});

test("the release runbook exists and is linked", () => {
  assert.ok(existsSync("docs/RELEASE.md"));
  assert.ok(read("README.md").includes("](docs/RELEASE.md)"));
});
