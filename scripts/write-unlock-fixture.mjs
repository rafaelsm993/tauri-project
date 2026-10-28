import { buildUnlockFixture } from "./unlock-fixture.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const out = process.argv[2],
  day = process.argv[3];
assert.ok(out && day, "usage: node scripts/write-unlock-fixture.mjs OUTPUT YYYY-MM-DD");
const catalog = process.argv[4] ? JSON.parse(await readFile(process.argv[4], "utf8")).catalog : {};
const x = await buildUnlockFixture(day, catalog);
await mkdir(out, { recursive: true, mode: 0o700 });
const lib = JSON.stringify(x.library, null, 2) + "\n";
for (const [name, bytes] of [
  ["library.json", lib],
  ["library.json.bak", lib],
  ["events.jsonl", x.events.map((e) => JSON.stringify(e)).join("\n") + "\n"],
  ["summary.json", JSON.stringify(x.summary, null, 2) + "\n"],
])
  await writeFile(join(resolve(out), name), bytes, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify(x.summary));
