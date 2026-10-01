import { describe, expect, it } from "vitest";
import { finishShift, planFor, plannerData, weekView } from "./planner";
import type { Length, LibraryEntry, LibraryStatus, Plan } from "$lib/types/library";
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

const MWF: Plan = { days: [0, 2, 4], max_session_minutes: 60, since: "2026-09-28" };

function entry(
  id: number,
  type: MediaType,
  length: Partial<Length>,
  plan: Plan | null = MWF,
  status: LibraryStatus = "in_progress",
  progress = 0,
): LibraryEntry {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: `T${id}`,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: { status, progress, rating: null, review: null, length: len(length), plan },
    created_at: "",
    updated_at: "",
  };
}

const TODAY = "2026-10-01";

describe("planFor", () => {
  it("plans the remaining time from today on the plan's days", () => {
    const tv = entry(1, "tv", { episodes: 10, episode_minutes: 45 }, MWF, "in_progress", 4);
    expect(planFor(tv, MWF, TODAY)).toMatchObject({
      kind: "planned",
      finish: "2026-10-12",
      sessions: [
        { date: "2026-10-02", minutes: 54 },
        { date: "2026-10-05", minutes: 54 },
        { date: "2026-10-07", minutes: 54 },
        { date: "2026-10-09", minutes: 54 },
        { date: "2026-10-12", minutes: 54 },
      ],
    });
  });

  it("asks for exactly what is missing, and never for a dropped item", () => {
    const manga = entry(2, "manga", { chapters: 100 });
    expect(planFor(manga, MWF, TODAY)).toEqual({ kind: "needs", missing: ["chapter_minutes"] });
    const dropped = entry(3, "book", {}, MWF, "dropped");
    expect(planFor(dropped, MWF, TODAY)).toEqual({ kind: "dropped" });
  });

  it("sizes a book with the reading pace", () => {
    const book = entry(4, "book", { pages: 300 });
    const slow = planFor(book, { ...MWF, max_session_minutes: 600 }, TODAY, 30);
    const fast = planFor(book, { ...MWF, max_session_minutes: 600 }, TODAY, 60);
    expect(slow).toMatchObject({ sessions: [{ minutes: 600 }] });
    expect(fast).toMatchObject({ sessions: [{ minutes: 300 }] });
  });

  it("an item with nothing left is done", () => {
    const watched = entry(5, "movie", { runtime_minutes: 120 }, MWF, "completed", 1);
    expect(planFor(watched, MWF, TODAY)).toEqual({ kind: "done" });
  });
});

describe("plannerData", () => {
  it("lists planned items by finish date, then title, and keeps the rest apart", () => {
    const long = entry(1, "game", { hours: 10 });
    const short = entry(2, "movie", { runtime_minutes: 90 });
    const tie = entry(3, "movie", { runtime_minutes: 90 });
    const needs = entry(4, "manga", { chapters: 50 });
    const unplanned = entry(5, "tv", { episodes: 3, episode_minutes: 20 }, null);
    const dropped = entry(6, "movie", { runtime_minutes: 90 }, MWF, "dropped");
    const completed = entry(7, "movie", { runtime_minutes: 90 }, MWF, "completed", 1);
    const data = plannerData([long, tie, needs, unplanned, short, dropped, completed], TODAY);
    expect(data.planned.map((p) => p.entry.key)).toEqual([short.key, tie.key, long.key]);
    expect(data.planned[0]).toMatchObject({ family: "screen", finish: "2026-10-05" });
    expect(data.needs).toEqual([{ entry: needs, missing: ["chapter_minutes"] }]);
  });

  it("an empty library plans nothing", () => {
    expect(plannerData([], TODAY)).toEqual({ planned: [], needs: [] });
  });
});

describe("weekView", () => {
  const anime = entry(1, "anime", { episodes: 6, episode_minutes: 20 });
  const game = entry(2, "game", { hours: 3 });
  const data = plannerData([anime, game], TODAY);

  it("has 7 days from Monday with each item's blocks on its days", () => {
    const week = weekView(data.planned, TODAY);
    expect(week.map((d) => d.date)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    const fri = week[4];
    expect(fri.blocks).toEqual([
      { id: `${anime.key}@2026-10-02`, key: anime.key, title: "T1", family: "anime", minutes: 60 },
      { id: `${game.key}@2026-10-02`, key: game.key, title: "T2", family: "game", minutes: 60 },
    ]);
    expect(fri.total).toBe(120);
    expect(week[3].blocks).toEqual([]);
    expect(week[3].total).toBe(0);
  });

  it("shows a later week and stays empty after every plan ends", () => {
    const next = weekView(data.planned, "2026-10-07");
    expect(next[0].date).toBe("2026-10-05");
    expect(next[0].blocks.map((b) => b.key)).toEqual([anime.key, game.key]);
    expect(weekView(data.planned, "2026-12-01").every((d) => d.blocks.length === 0)).toBe(true);
  });

  it("gives every block a unique id", () => {
    const ids = weekView(data.planned, "2026-10-05").flatMap((d) => d.blocks.map((b) => b.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("finishShift", () => {
  it.each([
    ["2026-10-07", "2026-10-14", { dir: "later", days: 7 }],
    ["2026-10-14", "2026-10-07", { dir: "earlier", days: 7 }],
    ["2026-10-07", "2026-10-07", { dir: "same", days: 0 }],
    ["2026-12-31", "2027-01-01", { dir: "later", days: 1 }],
  ] as const)("%s → %s", (before, after, out) => {
    expect(finishShift(before, after)).toEqual(out);
  });
});
