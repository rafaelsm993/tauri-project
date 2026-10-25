import { afterEach, describe, expect, it, vi } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { library } from "$lib/api/library";
import { LibraryStore } from "./library.svelte";
import { GamificationStore } from "./gamification.svelte";
import { PrefsStore } from "./prefs.svelte";
import { UnlocksStore } from "./unlocks.svelte";
import { emptyLength } from "$lib/domain/length";
import { DEFAULT_PREFS } from "$lib/types/prefs";
import type { LibraryEntry, LibraryEvent, UserData } from "$lib/types/library";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  clearMocks();
});

async function setup(profileArt = "default") {
  const key = "tmdb:movie:4";
  const entry: LibraryEntry = {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: "movie",
      title: "Long film",
      year: "2026",
      poster_path: null,
      poster_file: null,
    },
    user: {
      status: "completed",
      progress: 1,
      rating: null,
      review: null,
      plan: null,
      length: { ...emptyLength(), runtime_minutes: 3000 },
    },
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T12:00:00Z",
  };
  let entries = [entry];
  let log: LibraryEvent[] = Array.from({ length: 4 }, (_, i) => ({
    id: `seed-${i}`,
    kind: "library_add",
    media_key: `tmdb:movie:${i + 1}`,
    at_utc: "2026-09-01T12:00:00Z",
    local_date: "2026-09-01",
    payload: { status: "completed" },
  }));
  let remove: () => Promise<boolean> = async () => true;
  let failActivity = false;
  let failCollection = false;
  mockIPC(async (cmd, args) => {
    if (cmd === "library_load") {
      if (failCollection) throw new Error("library unreadable");
      return entries;
    }
    if (cmd === "library_poster_dir") return null;
    if (cmd === "library_events") {
      if (failActivity) throw new Error("activity unreadable");
      return log;
    }
    if (cmd === "library_aliases") return {};
    if (cmd === "library_remove") return remove();
    if (cmd === "library_update") {
      const patch = (args as { patch: Partial<UserData> }).patch;
      entries = [{ ...entry, user: { ...entry.user, ...patch } }];
      return entries[0];
    }
    throw new Error(`Unexpected IPC ${cmd}`);
  });
  const lib = new LibraryStore(library);
  const update = vi.fn(async () => ({
    ...DEFAULT_PREFS,
    seen_level: 25,
    accent: "ember",
    profile_art: profileArt,
  }));
  const prefs = new PrefsStore({
    load: vi.fn(async () => ({
      ...DEFAULT_PREFS,
      seen_level: 25,
      accent: "ember",
      profile_art: profileArt,
    })),
    update,
  });
  const gam = new GamificationStore(
    {
      ...library,
      onEvent: (fn) => {
        const stop = library.onEvent(fn);
        stops.push(stop);
        return stop;
      },
    },
    () => lib.entries,
    () => "2026-09-01",
    { get: () => 25, set: vi.fn(async () => {}) },
  );
  const equipment = new UnlocksStore(
    prefs,
    () => (lib.ready && gam.loaded ? gam.level.level : null),
    () => (lib.ready ? lib.entries : null),
  );
  await lib.hydrate();
  await prefs.hydrate();
  await gam.load();
  expect(gam.level.level).toBe(3);
  expect(equipment.accent).toBe("ember");
  return {
    lib,
    gam,
    prefs,
    equipment,
    update,
    key,
    failActivity: () => {
      failActivity = true;
    },
    failCollection: () => {
      failCollection = true;
    },
    failRemove: () => {
      let reject!: (reason: Error) => void;
      remove = () =>
        new Promise((_, fail) => {
          reject = fail;
        });
      return (error: Error) => reject(error);
    },
    replace: () => {
      entries = [];
      log = [];
    },
  };
}

describe("eligibility through library operations", () => {
  it("restores completion artwork after failed optimistic removal, but relocks on uncompletion", async () => {
    const { lib, gam, equipment, prefs, update, key, failRemove } = await setup("movie:1");
    const xp = gam.xp;
    expect(equipment.profileArt).toBe("movie:1");
    const reject = failRemove();
    const pending = lib.remove(key);
    expect(equipment.profileArt).toBe("default");
    reject(new Error("Disk full"));
    expect(await pending).toBe(false);
    expect(equipment.profileArt).toBe("movie:1");
    expect(await lib.update(key, { status: "planning", progress: 0 })).toBe(true);
    expect(gam.xp).toBe(xp);
    expect(equipment.profileArt).toBe("default");
    expect(await lib.update(key, { status: "completed", progress: 1 })).toBe(true);
    expect(equipment.profileArt).toBe("movie:1");
    expect(prefs.prefs.profile_art).toBe("movie:1");
    expect(update).not.toHaveBeenCalled();
  });
  it("does not authorize artwork from failed quiet activity or collection reloads", async () => {
    const a = await setup("movie:1");
    a.failActivity();
    await a.gam.load({ quiet: true });
    expect(a.gam.loaded).toBe(false);
    expect(a.equipment.profileArt).toBe("default");
    expect(a.prefs.prefs.profile_art).toBe("movie:1");
    expect(a.update).not.toHaveBeenCalled();
    const b = await setup("movie:1");
    b.failCollection();
    await b.lib.reload();
    expect(b.equipment.profileArt).toBe("default");
    expect(b.update).not.toHaveBeenCalled();
  });
  it("relocks artwork immediately on import replacement without rewriting its preference", async () => {
    const s = await setup("movie:1");
    s.replace();
    const pending = s.lib.reload();
    expect(s.equipment.profileArt).toBe("default");
    await pending;
    await s.gam.load({ quiet: true });
    expect(s.equipment.profileArt).toBe("default");
    expect(s.prefs.prefs.profile_art).toBe("movie:1");
    expect(s.update).not.toHaveBeenCalled();
  });
  it("restores the effective accent after an optimistic removal fails without changing prefs", async () => {
    const { lib, gam, prefs, equipment, update, key, failRemove } = await setup();
    const before = gam.xp;
    const reject = failRemove();
    const pending = lib.remove(key);
    expect(lib.has(key)).toBe(false);
    expect(gam.level.level).toBe(2);
    expect(equipment.accent).toBe("default");
    reject(new Error("read-only disk"));
    expect(await pending).toBe(false);
    expect(lib.has(key)).toBe(true);
    expect(gam.xp).toBe(before);
    expect(equipment.accent).toBe("ember");
    expect(prefs.prefs).toMatchObject({ accent: "ember", seen_level: 25 });
    expect(update).not.toHaveBeenCalled();
    expect(gam.moment).toBeNull();
  });

  it("retracts accepted removal XP and never repairs the stored selection", async () => {
    const { lib, gam, prefs, equipment, update, key } = await setup();
    const before = gam.xp;
    expect(await lib.remove(key)).toBe(true);
    expect(gam.level.level).toBe(2);
    expect(gam.xp).toBeLessThan(before);
    expect(equipment.accent).toBe("default");
    expect(prefs.prefs.accent).toBe("ember");
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps completion XP when an item becomes incomplete", async () => {
    const { lib, gam, equipment, update, key } = await setup();
    const before = gam.xp;
    expect(await lib.update(key, { progress: 0, status: "planning" })).toBe(true);
    expect(gam.xp).toBe(before);
    expect(equipment.accent).toBe("ember");
    expect(gam.moment).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("recomputes current eligibility after imported library and event replacement", async () => {
    const { lib, gam, prefs, equipment, update, replace } = await setup();
    replace();
    await Promise.all([lib.reload(), prefs.reload()]);
    await gam.load({ quiet: true });
    expect(gam.level.level).toBe(1);
    expect(gam.xp).toBe(0);
    expect(equipment.accent).toBe("default");
    expect(prefs.prefs).toMatchObject({ accent: "ember", seen_level: 25 });
    expect(update).not.toHaveBeenCalled();
    expect(gam.moment).toBeNull();
  });
});
