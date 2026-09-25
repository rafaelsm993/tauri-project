import { describe, expect, it, vi } from "vitest";
import { LibraryStore, type LibraryClient } from "./library.svelte";
import type { LibraryEntry, UserData } from "$lib/types/library";
import type { MediaItem } from "$lib/types/media";

const ITEM = {
  id: 7,
  provider: "tmdb",
  media_key: "tmdb:tv:7",
  media_type: "tv",
  title: "Arcane",
  overview: "",
  poster_path: "/p.jpg",
  backdrop_path: null,
  vote_average: 0,
  vote_count: 0,
} as unknown as MediaItem;

const USER: UserData = { status: "planning", progress: 0, rating: null, review: null };

function entry(over: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    key: "tmdb:tv:7",
    snapshot: {
      media_key: "tmdb:tv:7",
      provider: "tmdb",
      media_type: "tv",
      title: "Arcane",
      poster_path: "/p.jpg",
      year: "2021",
    },
    user: { ...USER },
    created_at: "2026-09-25T12:00:00Z",
    updated_at: "2026-09-25T12:00:00Z",
    ...over,
  };
}

function fakeClient(over: Partial<LibraryClient> = {}): LibraryClient {
  return {
    load: vi.fn(async () => []),
    add: vi.fn(async () => entry()),
    update: vi.fn(async (_key: string, patch: Partial<UserData>) =>
      entry({ user: { ...USER, ...patch }, updated_at: "2026-09-25T13:00:00Z" }),
    ),
    remove: vi.fn(async () => true),
    ...over,
  };
}

describe("hydrate", () => {
  it("loads the saved library once and exposes it", async () => {
    const store = new LibraryStore(fakeClient({ load: vi.fn(async () => [entry()]) }));
    await store.hydrate();
    expect(store.entries).toHaveLength(1);
    expect(store.has("tmdb:tv:7")).toBe(true);
    expect(store.ready).toBe(true);
  });

  it("does not call the backend twice", async () => {
    const client = fakeClient();
    const store = new LibraryStore(client);
    await store.hydrate();
    await store.hydrate();
    expect(client.load).toHaveBeenCalledTimes(1);
  });

  it("surfaces a load failure without throwing", async () => {
    const store = new LibraryStore(
      fakeClient({
        load: vi.fn(async () => {
          throw new Error("disk gone");
        }),
      }),
    );
    await store.hydrate();
    expect(store.error).toContain("disk gone");
    expect(store.entries).toHaveLength(0);
  });
});

describe("optimistic add", () => {
  it("shows the entry before the backend answers", async () => {
    let resolve!: (e: LibraryEntry) => void;
    const store = new LibraryStore(
      fakeClient({ add: vi.fn(() => new Promise<LibraryEntry>((r) => (resolve = r))) }),
    );
    const pending = store.add(ITEM);
    expect(store.has("tmdb:tv:7")).toBe(true);
    expect(store.isPending("tmdb:tv:7")).toBe(true);
    resolve(entry());
    await pending;
    expect(store.isPending("tmdb:tv:7")).toBe(false);
  });

  it("replaces the optimistic entry with the backend's version", async () => {
    const store = new LibraryStore(
      fakeClient({ add: vi.fn(async () => entry({ created_at: "REAL", updated_at: "REAL" })) }),
    );
    await store.add(ITEM);
    expect(store.get("tmdb:tv:7")?.created_at).toBe("REAL");
  });

  it("removes the entry again when the write fails", async () => {
    const store = new LibraryStore(
      fakeClient({
        add: vi.fn(async () => {
          throw new Error("disk full");
        }),
      }),
    );
    await store.add(ITEM);
    expect(store.has("tmdb:tv:7")).toBe(false);
    expect(store.error).toContain("disk full");
  });

  it("ignores a second add of the same key", async () => {
    const client = fakeClient();
    const store = new LibraryStore(client);
    await store.add(ITEM);
    await store.add(ITEM);
    expect(client.add).toHaveBeenCalledTimes(1);
    expect(store.entries).toHaveLength(1);
  });

  it("carries the starting user data through to the backend", async () => {
    const client = fakeClient();
    const store = new LibraryStore(client);
    await store.add(ITEM, { status: "in_progress" });
    expect(client.add).toHaveBeenCalledWith(ITEM, { status: "in_progress" });
  });
});

describe("optimistic update", () => {
  it("applies the patch immediately", async () => {
    let resolve!: (e: LibraryEntry) => void;
    const store = new LibraryStore(
      fakeClient({
        load: vi.fn(async () => [entry()]),
        update: vi.fn(() => new Promise<LibraryEntry>((r) => (resolve = r))),
      }),
    );
    await store.hydrate();
    const pending = store.update("tmdb:tv:7", { progress: 5 });
    expect(store.get("tmdb:tv:7")?.user.progress).toBe(5);
    resolve(entry({ user: { ...USER, progress: 5 } }));
    await pending;
    expect(store.get("tmdb:tv:7")?.user.progress).toBe(5);
  });

  it("restores the previous values when the backend rejects the patch", async () => {
    const store = new LibraryStore(
      fakeClient({
        load: vi.fn(async () => [
          entry({ user: { status: "in_progress", progress: 3, rating: 8, review: null } }),
        ]),
        update: vi.fn(async () => {
          throw new Error("rating 11 is outside 1-10");
        }),
      }),
    );
    await store.hydrate();
    await store.update("tmdb:tv:7", { rating: 11 });
    const user = store.get("tmdb:tv:7")?.user;
    expect(user?.rating).toBe(8);
    expect(user?.progress).toBe(3);
    expect(user?.status).toBe("in_progress");
    expect(store.error).toContain("outside 1-10");
  });

  it("does nothing for a key it does not hold", async () => {
    const client = fakeClient();
    const store = new LibraryStore(client);
    await store.update("tmdb:tv:999", { progress: 1 });
    expect(client.update).not.toHaveBeenCalled();
  });
});

describe("optimistic remove", () => {
  it("drops the entry immediately and keeps it gone on success", async () => {
    const store = new LibraryStore(fakeClient({ load: vi.fn(async () => [entry()]) }));
    await store.hydrate();
    await store.remove("tmdb:tv:7");
    expect(store.has("tmdb:tv:7")).toBe(false);
  });

  it("puts the entry back when the delete fails", async () => {
    const store = new LibraryStore(
      fakeClient({
        load: vi.fn(async () => [entry()]),
        remove: vi.fn(async () => {
          throw new Error("locked");
        }),
      }),
    );
    await store.hydrate();
    await store.remove("tmdb:tv:7");
    expect(store.has("tmdb:tv:7")).toBe(true);
    expect(store.error).toContain("locked");
  });
});

describe("derived views", () => {
  it("counts entries by status", async () => {
    const store = new LibraryStore(
      fakeClient({
        load: vi.fn(async () => [
          entry({ key: "a", user: { ...USER, status: "completed" } }),
          entry({ key: "b", user: { ...USER, status: "completed" } }),
          entry({ key: "c", user: { ...USER, status: "planning" } }),
        ]),
      }),
    );
    await store.hydrate();
    expect(store.countByStatus.completed).toBe(2);
    expect(store.countByStatus.planning).toBe(1);
    expect(store.countByStatus.dropped).toBe(0);
  });

  it("orders entries by most recently updated", async () => {
    const store = new LibraryStore(
      fakeClient({
        load: vi.fn(async () => [
          entry({ key: "old", updated_at: "2026-09-01T00:00:00Z" }),
          entry({ key: "new", updated_at: "2026-09-25T00:00:00Z" }),
        ]),
      }),
    );
    await store.hydrate();
    expect(store.entries.map((e) => e.key)).toEqual(["new", "old"]);
  });
});
