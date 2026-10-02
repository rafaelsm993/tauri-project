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
    });
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
