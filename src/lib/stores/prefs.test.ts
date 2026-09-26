import { describe, expect, it, vi } from "vitest";
import { PrefsStore } from "./prefs.svelte";
import type { PrefsClient } from "$lib/api/prefs";
import type { PrefsPatch } from "$lib/types/prefs";

function fakeClient(over: Partial<PrefsClient> = {}): PrefsClient {
  return {
    load: vi.fn(async () => ({ background_animation: false })),
    update: vi.fn(async (patch: PrefsPatch) => ({ background_animation: true, ...patch })),
    ...over,
  };
}

describe("PrefsStore", () => {
  it("reload re-reads the backend after an import", async () => {
    const load = vi.fn(async () => ({ background_animation: true }));
    const store = new PrefsStore(fakeClient({ load }));
    await store.hydrate();
    load.mockResolvedValue({ background_animation: false });
    await store.reload();
    expect(store.prefs.background_animation).toBe(false);
  });

  it("starts with the defaults so the UI never waits for the file", () => {
    expect(new PrefsStore(fakeClient()).prefs.background_animation).toBe(true);
  });

  it("hydrate loads the saved prefs once", async () => {
    const client = fakeClient();
    const store = new PrefsStore(client);
    await store.hydrate();
    await store.hydrate();
    expect(store.prefs.background_animation).toBe(false);
    expect(client.load).toHaveBeenCalledTimes(1);
  });

  it("keeps the defaults and shows why when loading fails", async () => {
    const store = new PrefsStore(
      fakeClient({ load: vi.fn(async () => Promise.reject("disk on fire")) }),
    );
    await store.hydrate();
    expect(store.prefs.background_animation).toBe(true);
    expect(store.error).toBe("disk on fire");
    expect(store.ready).toBe(true);
  });

  it("ignores fields it does not know and wrong types", async () => {
    const store = new PrefsStore(
      fakeClient({ load: vi.fn(async () => ({ page: 1, background_animation: "no" }) as never) }),
    );
    await store.hydrate();
    expect(store.prefs).toEqual({ background_animation: true });
  });

  it("applies an update at once and keeps the backend's answer", async () => {
    const client = fakeClient();
    const store = new PrefsStore(client);
    const pending = store.update({ background_animation: false });
    expect(store.prefs.background_animation).toBe(false);
    await pending;
    expect(client.update).toHaveBeenCalledWith({ background_animation: false });
    expect(store.prefs.background_animation).toBe(false);
  });

  it("rolls back and shows why when saving fails", async () => {
    const store = new PrefsStore(
      fakeClient({ update: vi.fn(async () => Promise.reject(new Error("read-only disk"))) }),
    );
    await store.update({ background_animation: false });
    expect(store.prefs.background_animation).toBe(true);
    expect(store.error).toBe("read-only disk");
  });
});
