import { describe, expect, it } from "vitest";
import { emptyLength } from "./length";
import {
  choiceMinutes,
  customText,
  choiceOk,
  openAt,
  sessionScale,
  sessionText,
  tooShortText,
} from "./sessionScale";
import type { Length, LibraryEntry } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entry(type: MediaType, length: Partial<Length>, progress = 0): LibraryEntry {
  return {
    key: `tmdb:${type}:1`,
    snapshot: {
      media_key: `tmdb:${type}:1`,
      provider: "tmdb",
      media_type: type,
      title: "X",
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status: "in_progress",
      progress,
      rating: null,
      review: null,
      length: { ...emptyLength(), ...length },
      plan: null,
    },
    created_at: "",
    updated_at: "",
  };
}

const AOT = entry("anime", { episodes: 25, episode_minutes: 24 });

describe("sessionScale", () => {
  it("steps a show by whole episodes, up to 12 h or what is left", () => {
    expect(sessionScale(AOT, 30)).toEqual({
      kind: "units",
      step: 24,
      steps: 25,
      min: 24,
      noun: "episode",
      full: "Full episode",
      pages: false,
    });
    expect(sessionScale(entry("tv", { episodes: 10, episode_minutes: 300 }), 30)?.steps).toBe(2);
    expect(sessionScale(entry("tv", { episodes: 3, episode_minutes: 45 }, 2), 30)?.steps).toBe(1);
  });

  it("steps a manga by chapters", () => {
    expect(sessionScale(entry("manga", { chapters: 232, chapter_minutes: 20 }), 30)).toMatchObject({
      kind: "units",
      step: 20,
      noun: "chapter",
      full: "Full chapter",
    });
  });

  it("steps books and games by 30 minutes, up to what is left", () => {
    const book = sessionScale(entry("book", { pages: 300 }, 0), 30);
    expect(book).toEqual({
      kind: "time",
      step: 30,
      steps: 20,
      min: 30,
      noun: "",
      full: null,
      pages: true,
    });
    expect(sessionScale(entry("book", { pages: 600 }, 590), 30)?.steps).toBe(1);
    expect(sessionScale(entry("game", { hours: 40 }), 30)).toMatchObject({
      steps: 24,
      pages: false,
    });
  });

  it("starts a book or game at 30 minutes, or at the item's length when that is shorter", () => {
    expect(sessionScale(entry("game", { hours: 0.25 }), 30)).toMatchObject({
      step: 15,
      min: 15,
      steps: 1,
    });
    // 10 pages left at 30 pages/h is 20 min: the last session can still be logged.
    expect(sessionScale(entry("book", { pages: 600 }, 590), 30)).toMatchObject({
      step: 20,
      min: 20,
      steps: 1,
    });
  });

  it("has no scale for a movie, or without a length", () => {
    expect(sessionScale(entry("movie", { runtime_minutes: 127 }), 30)).toBeNull();
    expect(sessionScale(entry("anime", { episodes: 12 }), 30)).toBeNull();
    expect(sessionScale(entry("tv", { episodes: 2, episode_minutes: 800 }), 30)).toBeNull();
  });
});

describe("sessionText", () => {
  const scale = sessionScale(AOT, 30)!;
  const book = sessionScale(entry("book", { pages: 300 }), 30)!;
  const game = sessionScale(entry("game", { hours: 40 }), 30)!;

  it("names whole episodes, the first one as Full", () => {
    expect(sessionText(scale, 24, 30)).toEqual({ title: "Full episode", detail: "24 min" });
    expect(sessionText(scale, 72, 30)).toEqual({ title: "3 episodes", detail: "1 h 12 min" });
  });

  it("gives a book's time in pages at the reading pace, and a game's time alone", () => {
    expect(sessionText(book, 60, 30)).toEqual({ title: "1 h", detail: "≈ 30 pages" });
    expect(sessionText(book, 50, 30)).toEqual({ title: "50 min", detail: "≈ 25 pages" });
    expect(sessionText(game, 90, 30)).toEqual({ title: "1 h 30 min", detail: "" });
  });

  it("Custom says what typed minutes are worth in units and in time", () => {
    const manga = sessionScale(entry("manga", { chapters: 232, chapter_minutes: 20 }), 30)!;
    expect(customText(manga, 120, 30)).toBe("6 chapters · 2 h");
    expect(customText(manga, 50, 30)).toBe("≈ 3 chapters · 50 min");
    expect(customText(scale, 30, 30)).toBe("≈ 1 episode · 30 min");
    expect(customText(scale, 24, 30)).toBe("1 episode · 24 min");
    expect(customText(book, 50, 30)).toBe("≈ 25 pages · 50 min");
    expect(customText(game, 90, 30)).toBe("1 h 30 min");
  });

  it("says what the floor is", () => {
    expect(tooShortText(scale)).toBe("At least one episode (24 min).");
    expect(tooShortText(book)).toBe("At least 30 min.");
  });
});

describe("openAt / choiceMinutes / choiceOk", () => {
  const scale = sessionScale(AOT, 30)!;
  const book = sessionScale(entry("book", { pages: 300 }), 30)!;

  it("opens whole steps on them, anything else of at least the floor on Custom", () => {
    expect(openAt(scale, 72, false)).toEqual({ count: 3, custom: false, typed: 72 });
    expect(openAt(scale, 50, false)).toEqual({ count: 2, custom: true, typed: 50 });
    expect(openAt(scale, 15, false)).toEqual({ count: 1, custom: false, typed: 24 });
  });

  it("snaps to the nearest whole step when asked, never below one or above the cap", () => {
    expect(openAt(scale, 45, true)).toEqual({ count: 2, custom: false, typed: 48 });
    expect(openAt(scale, 5000, true).count).toBe(25);
    expect(openAt(book, 20, false)).toEqual({ count: 1, custom: false, typed: 30 });
    expect(openAt(book, 45, false)).toEqual({ count: 2, custom: true, typed: 45 });
  });

  it("turns a choice into minutes and checks the floor", () => {
    expect(choiceMinutes(scale, { count: 3, custom: false, typed: 0 })).toBe(72);
    expect(choiceMinutes(scale, { count: 99, custom: false, typed: 0 })).toBe(600);
    expect(choiceMinutes(scale, { count: 1, custom: true, typed: 50 })).toBe(50);
    expect(choiceOk(scale, 23)).toBe(false);
    expect(choiceOk(scale, 24)).toBe(true);
    expect(choiceOk(scale, 721)).toBe(false);
    expect(choiceOk(scale, Number.NaN)).toBe(false);
    expect(choiceOk(book, 29)).toBe(false);
    expect(choiceOk(book, 30)).toBe(true);
  });
});
