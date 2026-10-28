import test from "node:test";
import assert from "node:assert/strict";
import { buildUnlockFixture } from "./unlock-fixture.mjs";
test("creates genuine level-50 and every-completion-unlock data", async () => {
  const x = await buildUnlockFixture("2026-10-27");
  assert.ok(x.summary.level >= 50);
  assert.equal(x.summary.completed, 300);
  assert.equal(x.summary.avatarRewards, 30);
  assert.equal(x.summary.unlockedAvatars, 30);
  assert.equal(x.summary.globalRewards, x.summary.unlockedGlobalRewards);
  assert.equal(x.summary.titles, x.summary.earnedTitles);
  assert.equal(Object.keys(x.library.data.entries).length, 312);
  assert.equal(x.library.schema_version, 3);
  assert.equal(new Set(x.events.map((e) => e.id)).size, x.events.length);
  for (const e of Object.values(x.library.data.entries)) {
    assert.match(e.key, /^manual:(movie|tv|anime|manga|book|game):[0-9a-f-]{36}$/);
    assert.equal(e.key, e.snapshot.media_key);
    assert.ok(e.snapshot.title.startsWith("ZZTest "));
  }
  assert.equal(Object.values(x.library.data.entries).filter((e) => e.user.plan).length, 6);
  assert.deepEqual(x.library.data.merged, {});
  assert.deepEqual(x.library.data.retyped, {});
});

test("simulates chronological, varied progress rather than simultaneous completions", async () => {
  const x = await buildUnlockFixture("2026-10-27");
  const dates = x.events.map((e) => e.at_utc);
  assert.deepEqual(dates, [...dates].sort());
  assert.ok((Date.parse(dates.at(-1)) - Date.parse(dates[0])) / 86400000 > 730);
  const entries = Object.values(x.library.data.entries);
  assert.equal(entries.filter((e) => e.user.status === "in_progress").length, 5);
  assert.ok(
    new Set(entries.filter((e) => e.user.rating !== null).map((e) => e.user.rating)).size >= 4,
  );
  for (const e of entries) {
    const history = x.events.filter((v) => v.media_key === e.key);
    assert.equal(history[0].kind, "library_add");
    assert.equal(history[0].at_utc, e.created_at);
    assert.equal(history.at(-1).at_utc, e.updated_at);
    if (e.user.status === "completed" && e.snapshot.media_type !== "movie")
      assert.ok(history.some((v) => v.payload.progress > 0 && v.payload.status === "in_progress"));
  }
});
test("uses supplied catalog identities and metadata without pretending progress is provider data", async () => {
  const source = {
    snapshot: {
      media_key: "tmdb:movie:6001",
      provider: "tmdb",
      media_type: "movie",
      title: "Catalog test film",
      poster_path: "https://example.test/poster.jpg",
      poster_file: null,
      year: "1999",
    },
    length: { runtime_minutes: 143 },
    release: "1999-01-01",
  };
  const x = await buildUnlockFixture("2026-10-27", { movie: [source] });
  const e = x.library.data.entries[source.snapshot.media_key];
  assert.ok(e);
  assert.equal(e.snapshot.title, "Catalog test film");
  assert.equal(e.user.length.runtime_minutes, 143);
  assert.equal(x.summary.catalogEntries, 1);
  assert.equal(x.summary.simulatedHistory, true);
});

test("saved progress and history obey native whole-unit and binary-movie contracts", async () => {
  const x = await buildUnlockFixture("2026-10-27");
  for (const e of Object.values(x.library.data.entries)) {
    assert.ok(Number.isInteger(e.user.progress));
    if (e.snapshot.media_type === "movie") {
      assert.ok([0, 1].includes(e.user.progress));
      assert.equal(e.user.status, e.user.progress ? "completed" : "planning");
    }
  }
  for (const e of x.events)
    if ("progress" in e.payload) {
      assert.ok(Number.isInteger(e.payload.progress), e.media_key);
      if (e.media_key.startsWith("manual:movie:")) assert.ok([0, 1].includes(e.payload.progress));
    }
});
