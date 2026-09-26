// Keeps every component on the typed-destructure $props form.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(`${dir}/${e.name}`)
      : e.name.endsWith(".svelte")
        ? [`${dir}/${e.name}`]
        : [],
  );

test("components use `let { … }: Props = $props()`, not $props<T>()", () => {
  const offenders = walk("src").filter((f) => /\$props</.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, []);
});
