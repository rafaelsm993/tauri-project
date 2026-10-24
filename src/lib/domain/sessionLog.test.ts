import { describe, expect, it } from "vitest";
import { defaultMinutes, logPreview, minutesPerUnit } from "./sessionLog";
import { emptyLength } from "./length";
import type { LibraryEntry, LibraryStatus, Length, Plan } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

// Thu 2026-10-01; Mon-Thu, up to 45 min.
const TODAY = "2026-10-01";
const MON_THU: Plan = { days: [0, 1, 2, 3], max_session_minutes: 45, since: "2026-09-28" };

function entry(
  type: MediaType,
  length: Partial<Length>,
  progress = 0,
  status: LibraryStatus = "in_progress",
): LibraryEntry {
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
      status,
      progress,
      rating: null,
      review: null,
      length: { ...emptyLength(), ...length },
      plan: MON_THU,
    },
    created_at: "t",
    updated_at: "t",
  };
}

const FRIEREN = entry("anime", { episodes: 28, episode_minutes: 24 });

describe("minutesPerUnit", () => {
  it("reads each type's own unit", () => {
    expect(minutesPerUnit(FRIEREN)).toBe(24);
    expect(minutesPerUnit(entry("manga", { chapters: 100, chapter_minutes: 6 }))).toBe(6);
    expect(minutesPerUnit(entry("book", { pages: 300 }), 30)).toBe(2);
    expect(minutesPerUnit(entry("game", { hours: 20 }))).toBe(60);
    expect(minutesPerUnit(entry("movie", { runtime_minutes: 120 }))).toBe(120);
  });
});

describe("logPreview", () => {
  it("turns minutes into whole episodes and says what is left", () => {
    const p = logPreview(FRIEREN, MON_THU, 45, TODAY);
    expect(p).toMatchObject({ gained: 2, progress: 2, total: 28, status: "in_progress" });
    expect(p.finishes).toBe(false);
    // 672 - 48 = 624 min left, 45 min cap -> 14 sessions, scheduled from tomorrow.
    expect(p.remainingMinutes).toBe(624);
    expect(p.sessionsLeft).toBe(14);
    // Mon-Thu from Fri Oct 2: Oct 5-8, 12-15, 19-22, 26-27. Counting today would end on the 26th.
    expect(p.finish).toBe("2026-10-27");
  });

  it("rounds to the nearest whole unit, half up", () => {
    expect(logPreview(FRIEREN, MON_THU, 30, TODAY).gained).toBe(1); // 1.25
    expect(logPreview(FRIEREN, MON_THU, 36, TODAY).gained).toBe(2); // 1.5
    expect(logPreview(FRIEREN, MON_THU, 30, TODAY).remainingMinutes).toBe(648);
    // A short session records nothing; it still counts as the session.
    expect(logPreview(FRIEREN, MON_THU, 5, TODAY).gained).toBe(0);
  });

  it("counts a session as one unit when the item has no length to convert with", () => {
    const unknown = entry("anime", { episodes: 28 });
    expect(logPreview(unknown, MON_THU, 45, TODAY).gained).toBe(1);
  });

  it("starts a planned item", () => {
    const planned = entry("anime", { episodes: 28, episode_minutes: 24 }, 0, "planning");
    expect(logPreview(planned, MON_THU, 45, TODAY).status).toBe("in_progress");
  });

  it("finishes the item on its last session, never past the total", () => {
    const book = entry("book", { pages: 600 }, 590);
    const p = logPreview(book, MON_THU, 60, TODAY, 30);
    expect(p).toMatchObject({ gained: 10, progress: 600, status: "completed", finishes: true });
    expect(p).toMatchObject({ remainingMinutes: 0, sessionsLeft: 0, finish: null });
  });

  it("marks a movie watched", () => {
    const movie = entry("movie", { runtime_minutes: 120 });
    expect(logPreview(movie, MON_THU, 45, TODAY)).toMatchObject({
      gained: 1,
      progress: 1,
      status: "completed",
    });
  });

  it("knows whether today is a planned day", () => {
    expect(logPreview(FRIEREN, MON_THU, 45, TODAY).plannedDay).toBe(true);
    expect(logPreview(FRIEREN, MON_THU, 45, "2026-10-03").plannedDay).toBe(false); // Saturday
  });
});

describe("defaultMinutes", () => {
  it("uses today's due minutes, else the next session, else the cap", () => {
    expect(defaultMinutes(FRIEREN, MON_THU, TODAY, 30)).toBe(30);
    expect(defaultMinutes(FRIEREN, MON_THU, TODAY, null)).toBe(45);
    const unplannable = entry("anime", {});
    expect(defaultMinutes(unplannable, MON_THU, TODAY, null)).toBe(45);
  });
});
