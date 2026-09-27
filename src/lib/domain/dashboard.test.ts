import { describe, expect, it } from "vitest";
import {
  backlog,
  cumulative,
  familyBreakdown,
  familyOf,
  hoursDone,
  nextLevelEta,
  pace,
  statusCounts,
  xpByWeek,
  weekStart,
  activityByDay,
} from "./dashboard";
import type { Award } from "./gamification";
import type { Length, LibraryEntry, LibraryEvent, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

const len = (over: Partial<Length> = {}): Length => ({
  runtime_minutes: null,
  episodes: null,
  episode_minutes: null,
  chapters: null,
  chapter_minutes: null,
  pages: null,
  hours: null,
  ...over,
});

function entry(
  type: MediaType,
  status: LibraryStatus,
  length: Partial<Length> = {},
  progress = 0,
): LibraryEntry {
  const key = `p:${type}:${Math.random()}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: key,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: { status, progress, rating: null, review: null, length: len(length) },
    created_at: "",
    updated_at: "",
  };
}

const award = (local_date: string, media_key: string, xp: number): Award => ({
  event_id: `${local_date}${media_key}`,
  media_key,
  local_date,
  reason: "add",
  xp,
});

describe("families", () => {
  it("groups movies and TV as screen", () => {
    expect(familyOf("movie")).toBe("screen");
    expect(familyOf("tv")).toBe("screen");
    expect(familyOf("anime")).toBe("anime");
    expect(familyOf("game")).toBe("game");
  });
});

describe("weeks", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-09-21")).toBe("2026-09-21");
    expect(weekStart("2026-09-26")).toBe("2026-09-21");
    expect(weekStart("2026-09-27")).toBe("2026-09-21");
    expect(weekStart("2026-03-01")).toBe("2026-02-23");
  });

  it("sums XP per week and family, filling empty weeks up to today", () => {
    const got = xpByWeek(
      [
        award("2026-09-01", "tmdb:movie:1", 5),
        award("2026-09-02", "anilist:anime:2", 10),
        award("2026-09-16", "tmdb:tv:3", 50),
      ],
      "2026-09-22",
    );
    expect(got.map((w) => w.week)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
    expect(got[0]).toMatchObject({ screen: 5, anime: 10, manga: 0, book: 0, game: 0, total: 15 });
    expect(got[1].total).toBe(0);
    expect(got[2].screen).toBe(50);
  });

  it("is empty with no awards", () => {
    expect(xpByWeek([], "2026-09-22")).toEqual([]);
  });

  it("turns weekly values into a running total", () => {
    const weeks = xpByWeek(
      [award("2026-09-01", "tmdb:movie:1", 5), award("2026-09-08", "tmdb:movie:1", 7)],
      "2026-09-08",
    );
    expect(cumulative(weeks).map((w) => [w.screen, w.total])).toEqual([
      [5, 5],
      [12, 12],
    ]);
  });
});

describe("activity", () => {
  it("counts meaningful events per day, once per id", () => {
    const e = (id: string, kind: string, local_date: string): LibraryEvent => ({
      id,
      kind,
      media_key: "tmdb:movie:1",
      at_utc: "",
      local_date,
      payload: null,
    });
    const got = activityByDay([
      e("a", "library_add", "2026-09-01"),
      e("b", "library_update", "2026-09-01"),
      e("b", "library_update", "2026-09-01"),
      e("c", "library_remove", "2026-09-02"),
    ]);
    expect(got).toEqual(new Map([["2026-09-01", 2]]));
  });

  it("skips days that are not dates", () => {
    const e = (id: string, local_date: string): LibraryEvent => ({
      id,
      kind: "library_add",
      media_key: "tmdb:movie:1",
      at_utc: "",
      local_date,
      payload: null,
    });
    expect(activityByDay([e("a", ""), e("b", "junk"), e("c", "2026-09-01")])).toEqual(
      new Map([["2026-09-01", 1]]),
    );
  });
});

describe("bad dates", () => {
  it("builds weeks without throwing when an award has no valid day", () => {
    const got = xpByWeek(
      [award("", "tmdb:movie:1", 5), award("2026-09-14", "tmdb:movie:1", 5)],
      "2026-09-20",
    );
    expect(got.map((w) => w.week)).toEqual(["2026-09-14"]);
  });
});

describe("library breakdown", () => {
  it("counts items per status", () => {
    const got = statusCounts([
      entry("movie", "completed"),
      entry("tv", "completed"),
      entry("book", "planning"),
    ]);
    expect(got).toEqual({ planning: 1, in_progress: 0, completed: 2, dropped: 0 });
  });

  it("measures hours done from progress, the whole length once completed", () => {
    expect(hoursDone(entry("tv", "in_progress", { episodes: 10, episode_minutes: 30 }, 4))).toBe(2);
    expect(hoursDone(entry("tv", "completed", { episodes: 10, episode_minutes: 30 }, 4))).toBe(5);
    expect(hoursDone(entry("movie", "in_progress", { runtime_minutes: 90 }, 1))).toBe(1.5);
    expect(hoursDone(entry("game", "in_progress", { hours: 40 }, 12))).toBe(12);
    expect(hoursDone(entry("manga", "in_progress", { chapters: 100 }, 12))).toBe(0);
    expect(hoursDone(entry("book", "completed", { pages: 300 }))).toBe(0);
  });

  it("sums items, completions and hours per family", () => {
    const got = familyBreakdown([
      entry("movie", "completed", { runtime_minutes: 120 }),
      entry("tv", "planning"),
      entry("game", "in_progress", { hours: 40 }, 10),
    ]);
    expect(got.screen).toEqual({ items: 2, completed: 1, hours: 2 });
    expect(got.game).toEqual({ items: 1, completed: 0, hours: 10 });
    expect(got.book).toEqual({ items: 0, completed: 0, hours: 0 });
  });
});

describe("forecast", () => {
  it("adds up the hours left on planned and in-progress items, counting unknowns apart", () => {
    const got = backlog([
      entry("game", "in_progress", { hours: 40 }, 10),
      entry("movie", "planning", { runtime_minutes: 120 }),
      entry("anime", "planning", { episodes: 12 }),
      entry("book", "planning", { pages: 200 }),
      entry("movie", "completed", { runtime_minutes: 999 }),
      entry("movie", "dropped", { runtime_minutes: 999 }),
    ]);
    expect(got).toEqual({ hours: 32, items: 2, unknown: 2 });
  });

  it("measures XP per day over the last 30 days", () => {
    const got = pace(
      [
        award("2026-08-01", "tmdb:movie:1", 1000),
        award("2026-09-01", "tmdb:movie:1", 30),
        award("2026-09-20", "tmdb:movie:1", 60),
      ],
      "2026-09-20",
    );
    expect(got).toBe(3);
  });

  it("does not count XP dated after today in the pace", () => {
    expect(pace([award("2026-09-25", "tmdb:movie:1", 300)], "2026-09-20")).toBe(0);
  });

  it("estimates the days to the next level, null without a pace", () => {
    expect(nextLevelEta(100, 10)).toBe(10);
    expect(nextLevelEta(101, 10)).toBe(11);
    expect(nextLevelEta(100, 0)).toBeNull();
    expect(nextLevelEta(0, 5)).toBe(0);
  });
});
