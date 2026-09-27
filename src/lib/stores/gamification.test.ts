import { describe, expect, it, vi } from "vitest";
import { GamificationStore } from "./gamification.svelte";
import { XP } from "$lib/domain/gamification";
import type { LibraryEntry, LibraryEvent } from "$lib/types/library";

const ev = (id: string, payload: unknown, local_date = "2026-09-20"): LibraryEvent => ({
  id,
  kind: "library_add",
  media_key: `tmdb:movie:${id}`,
  at_utc: "",
  local_date,
  payload,
});

function storeWith(
  events: LibraryEvent[] | Error,
  entries: LibraryEntry[] = [],
  today: () => string = () => "2026-09-20",
) {
  const load = vi.fn(async () => {
    if (events instanceof Error) throw events;
    return events;
  });
  const store = new GamificationStore({ events: load }, () => entries, today);
  return { store, load };
}

function movie(id: string, runtime_minutes: number): LibraryEntry {
  const key = `tmdb:movie:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: "movie",
      title: key,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status: "completed",
      progress: 1,
      rating: null,
      review: null,
      length: {
        runtime_minutes,
        episodes: null,
        episode_minutes: null,
        chapters: null,
        chapter_minutes: null,
        pages: null,
        hours: null,
      },
    },
    created_at: "",
    updated_at: "",
  };
}

describe("GamificationStore", () => {
  it("starts at level 1 with nothing loaded", () => {
    const { store } = storeWith([]);
    expect(store.ready).toBe(false);
    expect(store.xp).toBe(0);
    expect(store.level.level).toBe(1);
    expect(store.title.name).toBe("Newcomer");
  });

  it("derives XP, level, title and streak from the log", async () => {
    const { store } = storeWith([
      ev("1", { status: "completed" }, "2026-09-19"),
      ev("2", { status: "completed", rating: 8 }, "2026-09-20"),
    ]);
    await store.load();
    expect(store.ready).toBe(true);
    expect(store.xp).toBe(2 * (XP.add + XP.completion) + XP.rating);
    expect(store.level).toMatchObject({ level: 1, into: 120, needed: 141 });
    expect(store.streak).toEqual({ current: 2, longest: 2 });
    expect(store.isEmpty).toBe(false);
  });

  it("reads the log again on every load, so an import shows up", async () => {
    const { store, load } = storeWith([ev("1", null)]);
    await store.load();
    load.mockResolvedValueOnce([ev("1", null), ev("2", null)]);
    await store.load();
    expect(store.xp).toBe(2 * XP.add);
  });

  it("keeps the last numbers and reports an error when the log can't be read", async () => {
    const { store } = storeWith(new Error("disk on fire"));
    await store.load();
    expect(store.error).toMatch(/disk on fire/);
    expect(store.ready).toBe(false);
  });

  it("is empty for a new user", async () => {
    const { store } = storeWith([]);
    await store.load();
    expect(store.isEmpty).toBe(true);
    expect(store.eta).toBeNull();
    expect(store.weeks).toEqual([]);
  });

  it("feeds the charts: weekly XP, daily activity, hours and completions", async () => {
    const { store } = storeWith([
      ev("1", { status: "completed" }, "2026-09-14"),
      ev("2", null, "2026-09-20"),
    ]);
    await store.load();
    expect(store.weeks.map((w) => [w.week, w.screen])).toEqual([
      ["2026-09-14", XP.add + XP.completion + XP.add],
    ]);
    expect(store.activity.get("2026-09-14")).toBe(1);
    expect(store.hours).toBe(0);
  });

  it("sizes a completion by the saved length when the log has none", async () => {
    const { store } = storeWith([ev("1", { status: "completed" })], [movie("1", 180)]);
    await store.load();
    expect(store.xp).toBe(XP.add + XP.completion + 15);
  });

  it("moves to the new day when asked, without reading the log again", async () => {
    let day = "2026-09-20";
    const { store, load } = storeWith([ev("1", null, "2026-09-20")], [], () => day);
    await store.load();
    expect(store.streak.current).toBe(1);
    day = "2026-09-22";
    store.refreshDay();
    expect(store.today).toBe("2026-09-22");
    expect(store.streak.current).toBe(0);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("knows when the log has history but the library is empty", async () => {
    const { store } = storeWith([ev("1", null)]);
    await store.load();
    expect(store.isEmpty).toBe(false);
    expect(store.libraryEmpty).toBe(true);
  });
});
