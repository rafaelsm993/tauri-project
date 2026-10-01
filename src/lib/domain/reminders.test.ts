import { describe, expect, it } from "vitest";
import {
  didSession,
  reminderText,
  replannedText,
  shouldToast,
  SNOOZE_MS,
  todaySessions,
  type DueSession,
} from "./reminders";
import type { Length, LibraryEntry, LibraryEvent, LibraryStatus, Plan } from "$lib/types/library";
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

const TODAY = "2026-10-01";
const DAILY: Plan = { days: [0, 1, 2, 3, 4, 5, 6], max_session_minutes: 60, since: TODAY };
const MWF: Plan = { days: [0, 2, 4], max_session_minutes: 60, since: "2026-09-28" };
const THU: Plan = { days: [3], max_session_minutes: 60, since: TODAY };

function entry(
  id: number,
  type: MediaType,
  length: Partial<Length>,
  plan: Plan | null = DAILY,
  status: LibraryStatus = "in_progress",
  title = `T${id}`,
): LibraryEntry {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: { status, progress: 0, rating: null, review: null, length: len(length), plan },
    created_at: "",
    updated_at: "",
  };
}

let n = 0;
const event = (kind: string, key: string, local_date: string, payload: unknown): LibraryEvent => ({
  id: `e${++n}`,
  kind,
  media_key: key,
  at_utc: `${local_date}T12:00:00Z`,
  local_date,
  payload,
});

const tenEpisodes = { episodes: 10, episode_minutes: 30 };

describe("didSession", () => {
  const key = "tmdb:tv:1";

  it("counts progress or a status change logged that day", () => {
    expect(didSession([event("library_update", key, TODAY, { progress: 3 })], key, TODAY)).toBe(
      true,
    );
    const status = event("library_update", key, TODAY, { status: "in_progress" });
    expect(didSession([status], key, TODAY)).toBe(true);
  });

  it("counts a plan moved past that day, as Done and Next session save it", () => {
    const moved = event("library_plan", key, TODAY, { ...DAILY, since: "2026-10-02" });
    expect(didSession([moved], key, TODAY)).toBe(true);
  });

  it("does not count a plan that still starts that day, a rating, another day or another item", () => {
    const events = [
      event("library_plan", key, TODAY, DAILY),
      event("library_update", key, TODAY, { rating: 8 }),
      event("library_update", key, "2026-09-30", { progress: 2 }),
      event("library_update", "tmdb:tv:2", TODAY, { progress: 2 }),
    ];
    expect(didSession(events, key, TODAY)).toBe(false);
  });
});

describe("todaySessions", () => {
  it("is empty without plans", () => {
    expect(todaySessions([entry(1, "tv", tenEpisodes, null)], [], TODAY)).toEqual({
      due: [],
      replanned: null,
    });
  });

  it("lists today's session with its minutes, family and finish", () => {
    const tv = entry(1, "tv", tenEpisodes);
    const { due } = todaySessions([tv], [], TODAY);
    expect(due).toEqual([{ entry: tv, family: "screen", minutes: 60, finish: "2026-10-05" }]);
  });

  it("leaves out a plan whose days skip today", () => {
    const tv = entry(1, "tv", tenEpisodes, { ...DAILY, days: [0, 1] });
    expect(todaySessions([tv], [], TODAY).due).toEqual([]);
  });

  it("leaves out a plan that resumes tomorrow", () => {
    const tv = entry(1, "tv", tenEpisodes, { ...DAILY, since: "2026-10-02" });
    expect(todaySessions([tv], [], TODAY).due).toEqual([]);
    expect(todaySessions([tv], [], "2026-10-02").due).toHaveLength(1);
  });

  it("leaves out an item with progress logged today but keeps one from yesterday", () => {
    const a = entry(1, "tv", tenEpisodes);
    const b = entry(2, "tv", tenEpisodes);
    const events = [
      event("library_update", a.key, TODAY, { progress: 2 }),
      event("library_update", b.key, "2026-09-30", { progress: 2 }),
    ];
    expect(todaySessions([a, b], events, TODAY).due.map((d) => d.entry.key)).toEqual([b.key]);
  });

  it("keeps an item that was only just planned today", () => {
    const tv = entry(1, "tv", tenEpisodes);
    const events = [event("library_plan", tv.key, TODAY, DAILY)];
    expect(todaySessions([tv], events, TODAY).due).toHaveLength(1);
  });

  it("never lists dropped, completed or unsized items", () => {
    const entries = [
      entry(1, "tv", tenEpisodes, DAILY, "dropped"),
      entry(2, "tv", tenEpisodes, DAILY, "completed"),
      entry(3, "tv", {}),
    ];
    expect(todaySessions(entries, [], TODAY).due).toEqual([]);
  });

  it("puts the longest session first, then by title", () => {
    const entries = [
      entry(1, "tv", { episodes: 1, episode_minutes: 30 }, DAILY, "in_progress", "Beta"),
      entry(2, "tv", tenEpisodes, DAILY, "in_progress", "Zeta"),
      entry(3, "tv", { episodes: 1, episode_minutes: 30 }, DAILY, "in_progress", "Alpha"),
    ];
    const titles = todaySessions(entries, [], TODAY).due.map((d) => d.entry.snapshot.title);
    expect(titles).toEqual(["Zeta", "Alpha", "Beta"]);
  });

  it("counts earlier plan days with nothing logged as re-planned", () => {
    const tv = entry(1, "tv", tenEpisodes, MWF, "in_progress", "Frieren");
    expect(todaySessions([tv], [], TODAY).replanned).toEqual({
      count: 2,
      title: "Frieren",
      finish: "2026-10-12",
    });
  });

  it("does not count an earlier plan day that had a session", () => {
    const tv = entry(1, "tv", tenEpisodes, MWF);
    const events = [event("library_update", tv.key, "2026-09-30", { progress: 1 })];
    expect(todaySessions([tv], events, TODAY).replanned?.count).toBe(1);
  });

  it("looks back one week at most", () => {
    const tv = entry(1, "tv", tenEpisodes, { ...MWF, since: "2026-09-01" });
    expect(todaySessions([tv], [], TODAY).replanned?.count).toBe(3);
  });

  it("names the item with the most re-planned sessions", () => {
    const a = entry(1, "tv", tenEpisodes, MWF, "in_progress", "Few");
    const b = entry(2, "tv", tenEpisodes, DAILY, "in_progress", "Many");
    const bDaily = { ...b, user: { ...b.user, plan: { ...DAILY, since: "2026-09-25" } } };
    const { replanned } = todaySessions([a, bDaily], [], TODAY);
    expect(replanned).toMatchObject({ count: 8, title: "Many" });
  });

  it("does not count days before the plan existed", () => {
    expect(todaySessions([entry(1, "tv", tenEpisodes, THU)], [], TODAY).replanned).toBeNull();
  });
});

describe("shouldToast", () => {
  const now = Date.parse("2026-10-01T10:00:00Z");
  const due = (key: string): DueSession => ({
    entry: entry(Number(key), "tv", tenEpisodes),
    family: "screen",
    minutes: 30,
    finish: TODAY,
  });
  const [a, b] = [due("1"), due("2")];
  const memory = (toasted: [string, number][] = [], snoozedUntil = 0) => ({
    toastedAt: new Map(toasted),
    snoozedUntil,
  });

  it("is null with nothing due or while snoozed", () => {
    expect(shouldToast([], memory(), now)).toBeNull();
    expect(shouldToast([a], memory([], now + 1), now)).toBeNull();
  });

  it("does not repeat a session within the snooze window", () => {
    expect(shouldToast([a], memory([[a.entry.key, now - SNOOZE_MS + 1]]), now)).toBeNull();
    expect(shouldToast([a], memory([[a.entry.key, now - SNOOZE_MS]]), now)).toBe(a);
  });

  it("moves to the next session when the first was just shown", () => {
    expect(shouldToast([a, b], memory([[a.entry.key, now]]), now)).toBe(b);
  });
});

describe("copy", () => {
  const SHAME = /behind|late\b|overdue|missed|fail/i;

  it("names the minutes and the item", () => {
    const d: DueSession = {
      entry: entry(1, "tv", {}, DAILY, "in_progress", "Dune"),
      family: "screen",
      minutes: 90,
      finish: TODAY,
    };
    expect(reminderText(d)).toBe("1 h 30 min of Dune planned for today");
  });

  it("says re-planned, never behind", () => {
    const one = replannedText({ count: 1, title: "Frieren", finish: "2026-10-28" });
    const many = replannedText({ count: 2, title: "Frieren", finish: "2026-10-28" });
    expect(one).toBe("1 earlier session re-planned · Frieren now finishes Wed, Oct 28");
    expect(many).toBe("2 earlier sessions re-planned · Frieren now finishes Wed, Oct 28");
    for (const type of ["movie", "tv", "anime", "manga", "book", "game"] as MediaType[]) {
      const d: DueSession = {
        entry: entry(1, type, {}),
        family: "screen",
        minutes: 30,
        finish: TODAY,
      };
      expect(reminderText(d)).not.toMatch(SHAME);
    }
    expect(one + many).not.toMatch(SHAME);
  });
});
