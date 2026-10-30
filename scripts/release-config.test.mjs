// Guards the release setup: pinned bundles, one version, and Android signing that never breaks dev builds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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
