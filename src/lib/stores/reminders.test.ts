import { describe, expect, it, vi } from "vitest";
import { ReminderStore, type ReminderDeps } from "./reminders.svelte";
import { SNOOZE_MS } from "$lib/domain/reminders";
import type { Length, LibraryEntry, LibraryEvent, Plan } from "$lib/types/library";

const DAILY: Plan = { days: [0, 1, 2, 3, 4, 5, 6], max_session_minutes: 60, since: "2026-10-01" };

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

function entry(id: number, title: string, plan: Plan | null = DAILY): LibraryEntry {
  const key = `tmdb:tv:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: "tv",
      title,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status: "in_progress",
      progress: 0,
      rating: null,
      review: null,
      length: len({ episodes: 10, episode_minutes: 30 }),
      plan,
    },
    created_at: "",
    updated_at: "",
  };
}

function setup(entries: LibraryEntry[] = [entry(1, "Dune")], ready = true) {
  let now = new Date(2026, 9, 1, 10, 0);
  const deps = {
    library: { entries, ready, error: "", plan: vi.fn(async () => {}) },
    game: { events: [] as LibraryEvent[], ready, moment: null as unknown },
    pace: () => 40,
    log: vi.fn(),
  } satisfies ReminderDeps;
  const store = new ReminderStore(deps, () => now);
  const later = (ms: number) => (now = new Date(now.getTime() + ms));
  return { store, deps, later };
}

describe("ReminderStore", () => {
  it("shows nothing until the library and the log are loaded", () => {
    const { store } = setup([entry(1, "Dune")], false);
    store.check();
    expect(store.toast).toBeNull();
  });

  it("shows today's session on check and logs it", () => {
    const { store, deps } = setup();
    store.check();
    expect(store.toast?.entry.snapshot.title).toBe("Dune");
    expect(deps.log).toHaveBeenCalledWith("[reminder] shown tmdb:tv:1");
  });

  it("keeps one reminder up instead of swapping it on the next focus", () => {
    const { store, later } = setup([entry(1, "Dune"), entry(2, "Arcane")]);
    store.check();
    later(60 * 1000);
    store.check();
    expect(store.toast?.entry.snapshot.title).toBe("Arcane");
  });

  it("does not show the same session again within three hours", () => {
    const { store, later } = setup();
    store.check();
    store.dismiss();
    later(60 * 60 * 1000);
    store.check();
    expect(store.toast).toBeNull();
    later(SNOOZE_MS);
    store.check();
    expect(store.toast?.entry.key).toBe("tmdb:tv:1");
  });

  it("Later hides every reminder for three hours", () => {
    const { store, deps, later } = setup([entry(1, "Dune"), entry(2, "Arcane")]);
    store.check();
    store.later();
    expect(store.toast).toBeNull();
    expect(deps.log).toHaveBeenCalledWith("[reminder] snoozed tmdb:tv:2");
    later(60 * 1000);
    store.check();
    expect(store.toast).toBeNull();
    later(SNOOZE_MS);
    store.check();
    expect(store.toast).not.toBeNull();
  });

  it("Done resumes the plan tomorrow and closes its toast", async () => {
    const { store, deps } = setup();
    store.check();
    await store.done("tmdb:tv:1");
    expect(deps.library.plan).toHaveBeenCalledWith("tmdb:tv:1", { ...DAILY, since: "2026-10-02" });
    expect(store.toast).toBeNull();
    expect(deps.log).toHaveBeenCalledWith("[reminder] done tmdb:tv:1");
  });

  it("Next session saves the same way and logs its own line", async () => {
    const { store, deps } = setup();
    await store.nextSession("tmdb:tv:1");
    expect(deps.library.plan).toHaveBeenCalledWith("tmdb:tv:1", { ...DAILY, since: "2026-10-02" });
    expect(deps.log).toHaveBeenCalledWith("[reminder] next session tmdb:tv:1");
  });

  it("keeps the toast when the save fails", async () => {
    const { store, deps } = setup();
    deps.library.plan.mockImplementation(async () => {
      deps.library.error = "Could not save.";
    });
    store.check();
    await store.done("tmdb:tv:1");
    expect(store.toast?.entry.key).toBe("tmdb:tv:1");
    expect(deps.log).not.toHaveBeenCalledWith("[reminder] done tmdb:tv:1");
  });

  it("marks an item busy while its save runs", async () => {
    const { store, deps } = setup();
    let finish = () => {};
    deps.library.plan.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    const saving = store.done("tmdb:tv:1");
    expect(store.busy("tmdb:tv:1")).toBe(true);
    finish();
    await saving;
    expect(store.busy("tmdb:tv:1")).toBe(false);
  });

  it("moves to the new day after midnight", () => {
    const { store, later } = setup([entry(1, "Dune", { ...DAILY, days: [4] })]);
    store.check();
    expect(store.today).toBe("2026-10-01");
    expect(store.toast).toBeNull();
    later(15 * 60 * 60 * 1000);
    store.check();
    expect(store.today).toBe("2026-10-02");
    expect(store.toast?.entry.key).toBe("tmdb:tv:1");
  });

  it("waits for a level-up to close before showing", () => {
    const { store, deps } = setup();
    deps.game.moment = { level: 2 };
    store.check();
    expect(store.visibleToast).toBeNull();
    deps.game.moment = null;
    expect(store.visibleToast?.entry.key).toBe("tmdb:tv:1");
  });
});
