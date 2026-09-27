import { describe, expect, it } from "vitest";
import {
  awards,
  celebration,
  hoursOf,
  lengthBucket,
  levelOf,
  levelUps,
  streaks,
  activeDays,
  titleFor,
  totalXp,
  xpForLevel,
  TITLES,
  XP,
} from "./gamification";
import type { Length, LibraryEvent } from "$lib/types/library";

let seq = 0;
function ev(
  kind: string,
  media_key: string,
  payload: unknown = null,
  local_date = "2026-09-20",
  id = `e${++seq}`,
): LibraryEvent {
  return { id, kind, media_key, at_utc: `${local_date}T12:00:00.000Z`, local_date, payload };
}

const add = (key: string, payload: unknown = null, date?: string) =>
  ev("library_add", key, payload, date);
const upd = (key: string, payload: unknown, date?: string) =>
  ev("library_update", key, payload, date);
const del = (key: string, date?: string) => ev("library_remove", key, null, date);

const len = (over: Partial<Length>): Length => ({
  runtime_minutes: null,
  episodes: null,
  episode_minutes: null,
  chapters: null,
  chapter_minutes: null,
  pages: null,
  hours: null,
  ...over,
});

const MOVIE = "tmdb:movie:1";
const ANIME = "anilist:anime:2";
const xpOf = (events: LibraryEvent[]) => totalXp(awards(events));
const reasons = (events: LibraryEvent[]) => awards(events).map((a) => a.reason);

describe("awards", () => {
  it("pays for an add once per item, even after remove and re-add", () => {
    expect(xpOf([add(MOVIE)])).toBe(XP.add);
    expect(xpOf([add(MOVIE), del(MOVIE), add(MOVIE)])).toBe(XP.add);
    expect(xpOf([add(MOVIE), add(ANIME)])).toBe(2 * XP.add);
  });

  it("pays for the first rating of an item only", () => {
    const events = [add(MOVIE), upd(MOVIE, { rating: 7 }), upd(MOVIE, { rating: 9 })];
    expect(reasons(events)).toEqual(["add", "rating"]);
    expect(reasons([add(MOVIE), upd(MOVIE, { rating: null })])).toEqual(["add"]);
  });

  it("pays for a completion once per item, ever", () => {
    const events = [
      add(MOVIE),
      upd(MOVIE, { status: "completed" }),
      upd(MOVIE, { status: "in_progress" }),
      upd(MOVIE, { status: "completed" }),
    ];
    expect(reasons(events)).toEqual(["add", "completion"]);
    expect(xpOf(events)).toBe(XP.add + XP.completion);
  });

  it("counts an item added as already completed, with its rating", () => {
    const events = [add(MOVIE, { status: "completed", rating: 8 })];
    expect(reasons(events)).toEqual(["add", "rating", "completion"]);
  });

  it("pays nothing for progress clicks", () => {
    const events = [add(ANIME), ...[1, 2, 3, 4, 5].map((p) => upd(ANIME, { progress: p }))];
    expect(xpOf(events)).toBe(XP.add);
  });

  it("adds the length bonus known at completion, base XP without a length", () => {
    const long = add(ANIME, { length: len({ episodes: 64, episode_minutes: 24 }) });
    expect(xpOf([long, upd(ANIME, { status: "completed" })])).toBe(XP.add + XP.completion + 40);
    expect(xpOf([add(MOVIE), upd(MOVIE, { status: "completed" })])).toBe(XP.add + XP.completion);
  });

  it("uses a length set by a later update", () => {
    const events = [
      add(MOVIE),
      upd(MOVIE, { length: len({ runtime_minutes: 150 }) }),
      upd(MOVIE, { status: "completed" }),
    ];
    expect(xpOf(events)).toBe(XP.add + XP.completion + 15);
  });

  it("counts a duplicated event id once", () => {
    const first = add(MOVIE);
    expect(xpOf([first, { ...first }])).toBe(XP.add);
  });

  it("ignores unknown kinds and payloads that are not objects", () => {
    expect(xpOf([ev("library_teleport", MOVIE), add(MOVIE, "junk"), upd(MOVIE, 42)])).toBe(XP.add);
  });

  it("dates each award with the event that earned it", () => {
    const got = awards([add(MOVIE, null, "2026-09-01"), upd(MOVIE, { rating: 5 }, "2026-09-03")]);
    expect(got.map((a) => [a.local_date, a.media_key])).toEqual([
      ["2026-09-01", MOVIE],
      ["2026-09-03", MOVIE],
    ]);
  });
});

describe("bad input", () => {
  it("ignores events whose day is not a YYYY-MM-DD date", () => {
    const got = awards([
      add(MOVIE, null, ""),
      add(ANIME, null, "2026-9-1"),
      add("itunes:book:3", null, "2026-09-01"),
    ]);
    expect(got.map((a) => a.media_key)).toEqual(["itunes:book:3"]);
  });

  it("falls back to the saved length when the log never carried one", () => {
    const lengths = new Map([[MOVIE, len({ runtime_minutes: 180 })]]);
    const got = awards([add(MOVIE), upd(MOVIE, { status: "completed" })], lengths);
    expect(totalXp(got)).toBe(XP.add + XP.completion + 15);
  });

  it("prefers the length the log carried at completion", () => {
    const lengths = new Map([[MOVIE, len({ runtime_minutes: 30 })]]);
    const got = awards(
      [add(MOVIE, { length: len({ runtime_minutes: 180 }) }), upd(MOVIE, { status: "completed" })],
      lengths,
    );
    expect(totalXp(got)).toBe(XP.add + XP.completion + 15);
  });
});

describe("length", () => {
  it("turns each media type's length into hours", () => {
    expect(hoursOf("movie", len({ runtime_minutes: 120 }))).toBe(2);
    expect(hoursOf("tv", len({ episodes: 10, episode_minutes: 30 }))).toBe(5);
    expect(hoursOf("anime", len({ episodes: 12 }))).toBeNull();
    expect(hoursOf("manga", len({ chapters: 30, chapter_minutes: 4 }))).toBe(2);
    expect(hoursOf("game", len({ hours: 43 }))).toBe(43);
    expect(hoursOf("book", len({ pages: 300 }))).toBeNull();
    expect(hoursOf("movie", null)).toBeNull();
  });

  it("buckets hours into short, medium, long and epic", () => {
    expect(lengthBucket(null)).toBeNull();
    expect(lengthBucket(1.9)).toBe("short");
    expect(lengthBucket(2)).toBe("medium");
    expect(lengthBucket(9.9)).toBe("medium");
    expect(lengthBucket(10)).toBe("long");
    expect(lengthBucket(50)).toBe("epic");
  });
});

describe("levels", () => {
  it("follows 50 × n^1.5, level 1 at zero", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(141);
    expect(xpForLevel(5)).toBe(559);
    expect(xpForLevel(10)).toBe(1581);
  });

  it("finds the level and the progress into it at the edges", () => {
    expect(levelOf(0)).toMatchObject({ level: 1, into: 0, needed: 141 });
    expect(levelOf(140).level).toBe(1);
    expect(levelOf(141)).toMatchObject({ level: 2, into: 0, needed: xpForLevel(3) - 141 });
    expect(levelOf(1581).level).toBe(10);
  });

  it("never goes down as XP grows", () => {
    let last = 1;
    for (let xp = 0; xp < 20000; xp += 37) {
      const { level, fraction } = levelOf(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThan(1);
      last = level;
    }
  });

  it("dates every level reached along the way", () => {
    const got = awards([
      add(MOVIE, { status: "completed", rating: 9 }, "2026-09-01"),
      add(
        ANIME,
        { status: "completed", rating: 9, length: len({ episodes: 64, episode_minutes: 24 }) },
        "2026-09-02",
      ),
    ]);
    expect(totalXp(got)).toBe(65 + 105);
    expect(levelUps(got)).toEqual([{ level: 2, local_date: "2026-09-02" }]);
  });
});

describe("titles", () => {
  it("gives the title of the band the level is in", () => {
    expect(titleFor(1).name).toBe("Newcomer");
    expect(titleFor(2).name).toBe("Newcomer");
    expect(titleFor(3).name).toBe("Curious Mind");
    expect(titleFor(11).name).toBe("Enthusiast");
    expect(titleFor(12).name).toBe("Connoisseur");
  });

  it("names the next title and when it comes", () => {
    expect(titleFor(4).next).toEqual({ name: "Regular", level: 5 });
    expect(titleFor(50)).toEqual({ name: "Aevum Eternal", next: null });
    expect(titleFor(99).name).toBe("Aevum Eternal");
  });

  it("has a ladder that starts at level 1 and only goes up", () => {
    expect(TITLES[0].level).toBe(1);
    TITLES.slice(1).forEach((t, i) => expect(t.level).toBeGreaterThan(TITLES[i].level));
  });
});

describe("celebration", () => {
  it("adopts the current level silently the first time", () => {
    expect(celebration(0, 7)).toEqual({ show: null, seen: 7 });
  });

  it("says nothing while the level stays put", () => {
    expect(celebration(4, 4)).toEqual({ show: null, seen: 4 });
  });

  it("congratulates a new level, naming the title only when it changes", () => {
    expect(celebration(3, 4)).toEqual({ show: { level: 4, newTitle: null }, seen: 4 });
    expect(celebration(2, 3)).toEqual({
      show: { level: 3, newTitle: "Curious Mind" },
      seen: 3,
    });
  });

  it("shows one moment for the highest level when several are crossed at once", () => {
    expect(celebration(1, 6)).toEqual({ show: { level: 6, newTitle: "Regular" }, seen: 6 });
  });

  it("follows the level down without a moment after a smaller backup replaces the data", () => {
    expect(celebration(9, 2)).toEqual({ show: null, seen: 2 });
  });
});

describe("streaks", () => {
  const days = (...d: string[]) => activeDays(d.map((date) => add(`x:${date}`, null, date)));

  it("counts add and update days once each, not removes", () => {
    const events = [
      add(MOVIE, null, "2026-09-01"),
      upd(MOVIE, { progress: 1 }, "2026-09-01"),
      del(MOVIE, "2026-09-02"),
      upd(ANIME, { rating: 3 }, "2026-09-03"),
    ];
    expect(activeDays(events)).toEqual(["2026-09-01", "2026-09-03"]);
  });

  it("is zero with no activity", () => {
    expect(streaks([], "2026-09-20")).toEqual({ current: 0, longest: 0 });
  });

  it("is still current when the last active day was yesterday", () => {
    expect(streaks(days("2026-09-18", "2026-09-19"), "2026-09-20")).toEqual({
      current: 2,
      longest: 2,
    });
    expect(streaks(days("2026-09-20"), "2026-09-20").current).toBe(1);
  });

  it("breaks after a full day off but keeps the longest", () => {
    const d = days("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10");
    expect(streaks(d, "2026-09-10")).toEqual({ current: 1, longest: 3 });
    expect(streaks(d, "2026-09-12")).toEqual({ current: 0, longest: 3 });
  });

  it("ignores days after today", () => {
    expect(streaks(days("2026-09-19", "2026-09-20", "2026-09-21"), "2026-09-20")).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("crosses month ends by calendar day", () => {
    expect(streaks(days("2026-02-28", "2026-03-01"), "2026-03-01").current).toBe(2);
  });
});
