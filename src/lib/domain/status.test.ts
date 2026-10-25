import { describe, expect, it } from "vitest";
import { progressPatch, resumeStatus, statusForProgress } from "./status";
import { emptyLength } from "./length";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entry(type: MediaType, status: LibraryStatus, progress: number): LibraryEntry {
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
    user: { status, progress, rating: null, review: null, length: emptyLength(), plan: null },
    created_at: "t",
    updated_at: "t",
  };
}

describe("statusForProgress", () => {
  it("is Planning at zero, In progress partway and Completed at the total", () => {
    expect(statusForProgress("manga", 0, 232)).toBe("planning");
    expect(statusForProgress("manga", 1, 232)).toBe("in_progress");
    expect(statusForProgress("manga", 231, 232)).toBe("in_progress");
    expect(statusForProgress("manga", 232, 232)).toBe("completed");
    expect(statusForProgress("manga", 300, 232)).toBe("completed");
  });

  it("never completes without a known total", () => {
    expect(statusForProgress("manga", 0, null)).toBe("planning");
    expect(statusForProgress("manga", 999, null)).toBe("in_progress");
  });

  it("treats a movie as watched or not", () => {
    expect(statusForProgress("movie", 1, null)).toBe("completed");
    expect(statusForProgress("movie", 0, null)).toBe("planning");
  });
});

describe("progressPatch", () => {
  it("adds the status only when the progress changes it", () => {
    expect(progressPatch(entry("tv", "planning", 0), 1, 10)).toEqual({
      progress: 1,
      status: "in_progress",
    });
    expect(progressPatch(entry("tv", "in_progress", 3), 4, 10)).toEqual({ progress: 4 });
    expect(progressPatch(entry("tv", "in_progress", 9), 10, 10)).toEqual({
      progress: 10,
      status: "completed",
    });
  });

  it("un-completes when progress goes back below the total", () => {
    expect(progressPatch(entry("tv", "completed", 10), 9, 10)).toEqual({
      progress: 9,
      status: "in_progress",
    });
    expect(progressPatch(entry("tv", "in_progress", 1), 0, 10)).toEqual({
      progress: 0,
      status: "planning",
    });
  });

  it("keeps a dropped item dropped", () => {
    expect(progressPatch(entry("tv", "dropped", 3), 10, 10)).toEqual({ progress: 10 });
  });
});

describe("resumeStatus", () => {
  it("is what the progress says", () => {
    expect(resumeStatus(entry("tv", "dropped", 0), 10)).toBe("planning");
    expect(resumeStatus(entry("tv", "dropped", 4), 10)).toBe("in_progress");
    expect(resumeStatus(entry("tv", "dropped", 10), 10)).toBe("completed");
  });
});
