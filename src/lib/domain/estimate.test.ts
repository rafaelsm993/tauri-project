import { describe, expect, it } from "vitest";
import { estimate } from "./estimate";
import type { Length, LibraryEntry, LibraryStatus } from "$lib/types/library";
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
  length: Partial<Length>,
  progress = 0,
  status: LibraryStatus = "in_progress",
): LibraryEntry {
  const key = `p:${type}:1`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: "T",
      poster_path: null,
      year: null,
      poster_file: null,
    },
    user: { status, progress, rating: null, review: null, length: len(length), plan: null },
    created_at: "",
    updated_at: "",
  };
}

describe("estimate", () => {
  it.each([
    ["movie", { runtime_minutes: 125 }, 0, 125, 125],
    ["tv", { episodes: 10, episode_minutes: 45 }, 4, 450, 270],
    ["anime", { episodes: 24, episode_minutes: 24 }, 0, 576, 576],
    ["manga", { chapters: 100, chapter_minutes: 6 }, 25, 600, 450],
    ["game", { hours: 40 }, 12, 2400, 1680],
    ["book", { pages: 300 }, 60, 600, 480],
  ] as const)("%s: total and remaining minutes", (type, length, progress, total, remaining) => {
    const e = estimate(entry(type, length, progress));
    expect(e).toMatchObject({
      kind: "plannable",
      totalMinutes: total,
      remainingMinutes: remaining,
    });
  });

  it("names exactly the missing fields", () => {
    expect(estimate(entry("manga", { chapters: 100 }))).toEqual({
      kind: "needs",
      missing: ["chapter_minutes"],
    });
    expect(estimate(entry("book", {}))).toEqual({ kind: "needs", missing: ["pages"] });
  });

  it("a completed item has nothing left", () => {
    const e = estimate(entry("tv", { episodes: 10, episode_minutes: 45 }, 3, "completed"));
    expect(e).toMatchObject({ remainingMinutes: 0 });
  });

  it("progress past the end never goes negative", () => {
    expect(estimate(entry("book", { pages: 100 }, 500))).toMatchObject({ remainingMinutes: 0 });
    expect(estimate(entry("tv", { episodes: 2, episode_minutes: 30 }, 9))).toMatchObject({
      remainingMinutes: 0,
    });
  });

  it("the reading pace sizes a book", () => {
    expect(estimate(entry("book", { pages: 300 }), 60)).toMatchObject({ totalMinutes: 300 });
  });

  it("a dropped item is not planned, even with its length missing", () => {
    expect(estimate(entry("tv", { episodes: 10, episode_minutes: 45 }, 4, "dropped"))).toEqual({
      kind: "dropped",
    });
    expect(estimate(entry("book", {}, 0, "dropped"))).toEqual({ kind: "dropped" });
  });
});
