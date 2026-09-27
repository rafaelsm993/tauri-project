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

// A client whose saves can be replayed into the store, and a saved level held in memory.
function live(log: LibraryEvent[], seenAt: number | null = 1) {
  let listener: ((e: LibraryEvent) => void) | null = null;
  let release: (() => void) | null = null;
  const gate = { hold: false };
  const client = {
    events: vi.fn(async () => {
      if (gate.hold) await new Promise<void>((r) => (release = r));
      return log;
    }),
    onEvent: (fn: (e: LibraryEvent) => void) => {
      listener = fn;
      return () => (listener = null);
    },
  };
  const seen = {
    value: seenAt,
    get: () => seen.value,
    set: vi.fn(async (level: number) => {
      seen.value = level;
    }),
  };
  const store = new GamificationStore(
    client,
    () => [],
    () => "2026-09-20",
    seen,
  );
  return {
    store,
    seen,
    gate,
    emit: (e: LibraryEvent) => listener?.(e),
    release: () => release?.(),
  };
}

// Two completions and a rating: 120 XP, 21 short of level 2.
const NEAR_LEVEL_2 = [
  ev("1", { status: "completed" }, "2026-09-19"),
  ev("2", { status: "completed", rating: 8 }, "2026-09-20"),
];

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

  it("moves the level the moment an event is saved", async () => {
    const { store, emit } = live(NEAR_LEVEL_2);
    await store.load();
    emit(ev("3", { status: "completed" }));
    expect(store.xp).toBe(175);
    expect(store.level.level).toBe(2);
  });

  it("counts an event it hears twice only once", async () => {
    const { store, emit } = live(NEAR_LEVEL_2);
    await store.load();
    emit(ev("3", { status: "completed" }));
    emit(ev("3", { status: "completed" }));
    expect(store.events).toHaveLength(3);
  });

  it("keeps an event saved while the log is still loading", async () => {
    const { store, emit, gate, release } = live(NEAR_LEVEL_2);
    gate.hold = true;
    const loading = store.load();
    await Promise.resolve();
    emit(ev("3", { status: "completed" }));
    release();
    await loading;
    expect(store.events.map((e) => e.id)).toEqual(["1", "2", "3"]);
  });

  it("keeps a live event when two loads overlap", async () => {
    const { store, emit, gate, release } = live(NEAR_LEVEL_2);
    gate.hold = true;
    const first = store.load();
    await Promise.resolve();
    gate.hold = false;
    const second = store.load();
    emit(ev("3", { status: "completed" }));
    await second;
    release();
    await first;
    expect(store.events.map((e) => e.id)).toEqual(["1", "2", "3"]);
    expect(store.error).toBe("");
  });

  it("knows when the log has history but the library is empty", async () => {
    const { store } = storeWith([ev("1", null)]);
    await store.load();
    expect(store.isEmpty).toBe(false);
    expect(store.libraryEmpty).toBe(true);
  });
});

describe("level-up moment", () => {
  it("celebrates a level crossed live, once, and remembers it", async () => {
    const { store, seen, emit } = live(NEAR_LEVEL_2);
    await store.load();
    expect(store.moment).toBeNull();
    emit(ev("3", { status: "completed" }));
    expect(store.moment).toEqual({ level: 2, newTitle: null });
    expect(store.burst).toBe(true);
    expect(seen.set).toHaveBeenCalledExactlyOnceWith(2);
    emit(ev("4", null));
    expect(seen.set).toHaveBeenCalledTimes(1);
  });

  it("adopts the level silently on the first run", async () => {
    const { store, seen } = live(NEAR_LEVEL_2, 0);
    await store.load();
    expect(store.moment).toBeNull();
    expect(seen.set).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("waits for the saved level before deciding anything", async () => {
    const { store, seen, emit } = live(NEAR_LEVEL_2, null);
    await store.load();
    emit(ev("3", { status: "completed" }));
    expect(store.moment).toBeNull();
    expect(seen.set).not.toHaveBeenCalled();
  });

  it("adopts an imported level without a moment", async () => {
    const { store, seen } = live([...NEAR_LEVEL_2, ev("3", { status: "completed" })]);
    await store.load({ quiet: true });
    expect(store.moment).toBeNull();
    expect(store.burst).toBe(false);
    expect(seen.set).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("clears the toast and the burst separately", async () => {
    const { store, emit } = live(NEAR_LEVEL_2);
    await store.load();
    emit(ev("3", { status: "completed" }));
    store.dismiss();
    expect(store.moment).toBeNull();
    expect(store.burst).toBe(true);
    store.burstDone();
    expect(store.burst).toBe(false);
  });
});
