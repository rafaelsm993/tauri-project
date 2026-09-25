import { describe, expect, it } from "vitest";
import {
  PROGRESS_UNITS,
  isBinary,
  percent,
  progressLabel,
  totalFor,
  unitLabel,
  clampProgress,
} from "./progress";
import type { MediaDetail } from "$lib/types/media";

const detail = (over: Partial<MediaDetail>): MediaDetail =>
  ({ media_type: "tv", ...over }) as MediaDetail;

describe("unit labels", () => {
  it("names one unit per media type, singular and plural", () => {
    expect(unitLabel("tv", 1)).toBe("episode");
    expect(unitLabel("tv", 12)).toBe("episodes");
    expect(unitLabel("anime", 2)).toBe("episodes");
    expect(unitLabel("manga", 1)).toBe("chapter");
    expect(unitLabel("book", 350)).toBe("pages");
    expect(unitLabel("game", 1)).toBe("hour");
    expect(unitLabel("game", 74)).toBe("hours");
  });

  it("has an entry for every media type", () => {
    const types = ["movie", "tv", "anime", "manga", "book", "game"] as const;
    for (const t of types) expect(PROGRESS_UNITS[t]).toBeDefined();
  });

  it("treats a movie as watched or not, with no unit noun", () => {
    expect(isBinary("movie")).toBe(true);
    expect(isBinary("tv")).toBe(false);
    expect(isBinary("game")).toBe(false);
  });
});

describe("totalFor", () => {
  it("reads episodes for tv and anime", () => {
    expect(totalFor("tv", detail({ episodes: 24 }))).toBe(24);
    expect(totalFor("anime", detail({ episodes: 12 }))).toBe(12);
  });

  it("reads chapters for manga", () => {
    expect(totalFor("manga", detail({ chapters: 139 }))).toBe(139);
  });

  it("converts the game runtime from minutes to whole hours", () => {
    // RAWG playtime is stored as minutes (src-tauri/src/api/rawg.rs:182).
    expect(totalFor("game", detail({ runtime: 74 * 60 }))).toBe(74);
    expect(totalFor("game", detail({ runtime: 90 }))).toBe(2);
  });

  it("gives a movie a total of 1", () => {
    expect(totalFor("movie", detail({ runtime: 148 }))).toBe(1);
  });

  it("returns null when the provider has no length", () => {
    expect(totalFor("tv", detail({ episodes: null }))).toBeNull();
    expect(totalFor("book", detail({}))).toBeNull();
    expect(totalFor("game", detail({ runtime: 0 }))).toBeNull();
    expect(totalFor("tv", null)).toBeNull();
  });
});

describe("percent", () => {
  it("is the share of the total, rounded", () => {
    expect(percent(6, 12)).toBe(50);
    expect(percent(1, 3)).toBe(33);
  });

  it("never exceeds 100, even past the total", () => {
    expect(percent(120, 74)).toBe(100);
  });

  it("is null without a total, so the bar can hide instead of lying", () => {
    expect(percent(5, null)).toBeNull();
    expect(percent(5, 0)).toBeNull();
  });

  it("is 0 at zero progress", () => {
    expect(percent(0, 12)).toBe(0);
  });
});

describe("progressLabel", () => {
  it("reads as a count of the total when the total is known", () => {
    expect(progressLabel("tv", 3, 12)).toBe("3 of 12 episodes");
    expect(progressLabel("book", 120, 350)).toBe("120 of 350 pages");
  });

  it("drops the total when it is unknown", () => {
    expect(progressLabel("manga", 41, null)).toBe("41 chapters");
    expect(progressLabel("game", 1, null)).toBe("1 hour");
  });

  it("says watched or not for a movie", () => {
    expect(progressLabel("movie", 1, 1)).toBe("Watched");
    expect(progressLabel("movie", 0, 1)).toBe("Not watched");
  });

  it("says not started at zero", () => {
    expect(progressLabel("tv", 0, 12)).toBe("Not started");
    expect(progressLabel("book", 0, null)).toBe("Not started");
  });

  it("keeps counting past the total instead of clamping the text", () => {
    expect(progressLabel("game", 120, 74)).toBe("120 of 74 hours");
  });
});

describe("clampProgress", () => {
  it("keeps a movie at 0 or 1", () => {
    expect(clampProgress("movie", 5)).toBe(1);
    expect(clampProgress("movie", 0)).toBe(0);
  });

  it("floors negatives and fractions everywhere", () => {
    expect(clampProgress("tv", -3)).toBe(0);
    expect(clampProgress("game", 7.8)).toBe(7);
  });

  it("leaves a valid count alone, above a provider total", () => {
    expect(clampProgress("game", 120)).toBe(120);
  });
});
