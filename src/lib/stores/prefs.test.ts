import { describe, expect, it, vi } from "vitest";
import { PrefsStore } from "./prefs.svelte";
import type { PrefsClient } from "$lib/api/prefs";
import { DEFAULT_PREFS, type PrefsPatch } from "$lib/types/prefs";

function fakeClient(over: Partial<PrefsClient> = {}): PrefsClient {
  return {
    load: vi.fn(async () => ({ ...DEFAULT_PREFS, motion: false })),
    update: vi.fn(async (patch: PrefsPatch) => ({ ...DEFAULT_PREFS, ...patch })),
    ...over,
  };
}

describe("PrefsStore", () => {
  it("defaults the new selections when an older backend file omits them", async () => {
    const store = new PrefsStore(
      fakeClient({ load: vi.fn(async () => ({ motion: false }) as never) }),
    );
    await store.hydrate();
    expect(store.prefs.title).toBe("automatic");
    expect(store.prefs.profile_art).toBe("default");
  });

  it("preserves shaped unknown selection IDs for future versions", async () => {
    const store = new PrefsStore(
      fakeClient({
        load: vi.fn(async () => ({ title: "Future title", profile_art: "future:crest" }) as never),
      }),
    );
    await store.hydrate();
    expect(store.prefs.title).toBe("Future title");
    expect(store.prefs.profile_art).toBe("future:crest");
  });

  it.each([null, 7, "", " \t", "x".repeat(81), "\u{1f31f}".repeat(81)])(
    "falls back for invalid selection shape %j",
    async (invalid) => {
      const store = new PrefsStore(
        fakeClient({
          load: vi.fn(async () => ({ title: invalid, profile_art: invalid }) as never),
        }),
      );
      await store.hydrate();
      expect(store.prefs.title).toBe("automatic");
      expect(store.prefs.profile_art).toBe("default");
    },
  );

  it("accepts eighty Unicode characters without counting surrogate pairs twice", async () => {
    const value = "\u{1f31f}".repeat(80);
    const store = new PrefsStore(
      fakeClient({ load: vi.fn(async () => ({ title: value, profile_art: value }) as never) }),
    );
    await store.hydrate();
    expect(store.prefs.title).toBe(value);
    expect(store.prefs.profile_art).toBe(value);
  });

  it("saves both selections without rewriting unrelated preferences", async () => {
    const client = fakeClient();
    const store = new PrefsStore(client);
    expect(await store.update({ title: "Curious Mind", profile_art: "manga:5" })).toBe(true);
    expect(client.update).toHaveBeenCalledExactlyOnceWith({
      title: "Curious Mind",
      profile_art: "manga:5",
    });
    expect(store.prefs.title).toBe("Curious Mind");
    expect(store.prefs.profile_art).toBe("manga:5");
  });

  it("marks successful hydration independently from an attempted load", async () => {
    const store = new PrefsStore(fakeClient());
    expect(store.loaded).toBe(false);
    await store.hydrate();
    expect(store.ready).toBe(true);
    expect(store.loaded).toBe(true);
  });

  it("does not report known prefs after an initial load failure, even if a save clears the error", async () => {
    const store = new PrefsStore(fakeClient({ load: vi.fn().mockRejectedValue("unreadable") }));
    await store.hydrate();
    expect(store.ready).toBe(true);
    expect(store.loaded).toBe(false);
    await store.update({ motion: false });
    expect(store.error).toBe("");
    expect(store.loaded).toBe(false);
  });

  it("keeps known prefs and rolls back both selections after a later failed save", async () => {
    const store = new PrefsStore(
      fakeClient({
        load: vi.fn(async () => ({
          ...DEFAULT_PREFS,
          title: "Curious Mind",
          profile_art: "manga:5",
        })),
        update: vi.fn().mockRejectedValue("read-only disk"),
      }),
    );
    await store.hydrate();
    expect(await store.update({ title: "automatic", profile_art: "default" })).toBe(false);
    expect(store.error).toBe("read-only disk");
    expect(store.loaded).toBe(true);
    expect(store.prefs.title).toBe("Curious Mind");
    expect(store.prefs.profile_art).toBe("manga:5");
  });

  it("invalidates known prefs during import reload and restores that state only on success", async () => {
    const load = vi.fn(async () => ({ ...DEFAULT_PREFS }));
    const store = new PrefsStore(fakeClient({ load }));
    await store.hydrate();
    let finish!: (value: typeof DEFAULT_PREFS) => void;
    load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = store.reload();
    expect(store.loaded).toBe(false);
    expect(store.ready).toBe(false);
    finish({ ...DEFAULT_PREFS, title: "Regular", profile_art: "book:5" });
    await pending;
    expect(store.loaded).toBe(true);
    expect(store.prefs.title).toBe("Regular");
    expect(store.prefs.profile_art).toBe("book:5");
    load.mockRejectedValueOnce("import reload failed");
    await store.reload();
    expect(store.loaded).toBe(false);
    expect(store.ready).toBe(true);
    await store.reload();
    expect(store.loaded).toBe(true);
    expect(store.error).toBe("");
  });

  it("reload re-reads the backend after an import", async () => {
    const load = vi.fn(async () => ({ ...DEFAULT_PREFS }));
    const store = new PrefsStore(fakeClient({ load }));
    await store.hydrate();
    load.mockResolvedValue({ ...DEFAULT_PREFS, motion: false });
    await store.reload();
    expect(store.prefs.motion).toBe(false);
  });

  it("starts with the defaults so the UI never waits for the file", () => {
    expect(new PrefsStore(fakeClient()).prefs.motion).toBe(true);
  });

  it("hydrate loads the saved prefs once", async () => {
    const client = fakeClient();
    const store = new PrefsStore(client);
    await store.hydrate();
    await store.hydrate();
    expect(store.prefs.motion).toBe(false);
    expect(client.load).toHaveBeenCalledTimes(1);
  });

  it("keeps the defaults and shows why when loading fails", async () => {
    const store = new PrefsStore(
      fakeClient({ load: vi.fn(async () => Promise.reject("disk on fire")) }),
    );
    await store.hydrate();
    expect(store.prefs.motion).toBe(true);
    expect(store.error).toBe("disk on fire");
    expect(store.ready).toBe(true);
  });

  it("ignores fields it does not know and wrong types", async () => {
    const store = new PrefsStore(
      fakeClient({ load: vi.fn(async () => ({ page: 1, motion: "no" }) as never) }),
    );
    await store.hydrate();
    expect(store.prefs).toEqual({
      motion: true,
      seen_level: 0,
      reading_pages_per_hour: null,
      manga_chapter_minutes: null,
      theme: "system",
      welcomed: false,
      welcome_beat: 0,
      taste_families: [],
      taste_genres: [],
      accent: "default",
      pack: "default",
      motif: "default",
      particle_count: 12,
      garden: "default",
      title: "automatic",
      profile_art: "default",
    });
  });

  it("drops a taste list that is not a list of strings", async () => {
    const store = new PrefsStore(
      fakeClient({
        load: vi.fn(
          async () => ({ taste_families: ["book", 7, null], taste_genres: "no" }) as never,
        ),
      }),
    );
    await store.hydrate();
    expect(store.prefs.taste_families).toEqual(["book"]);
    expect(store.prefs.taste_genres).toEqual([]);
  });

  it("keeps a known theme and drops an unknown one", async () => {
    const load = vi.fn(async () => ({ theme: "light" }) as never);
    const store = new PrefsStore(fakeClient({ load }));
    await store.hydrate();
    expect(store.prefs.theme).toBe("light");
    load.mockResolvedValue({ theme: "sepia" } as never);
    await store.reload();
    expect(store.prefs.theme).toBe("system");
  });

  it("keeps a saved reading pace and drops one that is not a whole number", async () => {
    const load = vi.fn(async () => ({ reading_pages_per_hour: 45 }) as never);
    const store = new PrefsStore(fakeClient({ load }));
    await store.hydrate();
    expect(store.prefs.reading_pages_per_hour).toBe(45);
    load.mockResolvedValue({ reading_pages_per_hour: "fast" } as never);
    await store.reload();
    expect(store.prefs.reading_pages_per_hour).toBeNull();
  });

  it("keeps saved minutes per chapter and drops ones that are not a whole number", async () => {
    const load = vi.fn(async () => ({ manga_chapter_minutes: 6 }) as never);
    const store = new PrefsStore(fakeClient({ load }));
    await store.hydrate();
    expect(store.prefs.manga_chapter_minutes).toBe(6);
    load.mockResolvedValue({ manga_chapter_minutes: 2.5 } as never);
    await store.reload();
    expect(store.prefs.manga_chapter_minutes).toBeNull();
  });

  it("keeps a saved level and drops one that is not a whole number", async () => {
    const load = vi.fn(async () => ({ ...DEFAULT_PREFS, seen_level: 4 }));
    const store = new PrefsStore(fakeClient({ load }));
    await store.hydrate();
    expect(store.prefs.seen_level).toBe(4);
    load.mockResolvedValue({ ...DEFAULT_PREFS, seen_level: -2.5 });
    await store.reload();
    expect(store.prefs.seen_level).toBe(0);
  });

  it("applies an update at once and keeps the backend's answer", async () => {
    const client = fakeClient();
    const store = new PrefsStore(client);
    const pending = store.update({ motion: false });
    expect(store.prefs.motion).toBe(false);
    expect(await pending).toBe(true);
    expect(client.update).toHaveBeenCalledWith({ motion: false });
    expect(store.prefs.motion).toBe(false);
  });

  it("rolls back and shows why when saving fails", async () => {
    const store = new PrefsStore(
      fakeClient({ update: vi.fn(async () => Promise.reject(new Error("read-only disk"))) }),
    );
    expect(await store.update({ motion: false })).toBe(false);
    expect(store.prefs.motion).toBe(true);
    expect(store.error).toBe("read-only disk");
  });
});
