import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { catalog } from "./catalog";
import { onlineStore } from "$lib/stores/online.svelte";

afterEach(() => {
  clearMocks();
  onlineStore.noteSuccess();
});

const EMPTY = { page: 1, total_pages: 1, total_results: 0, results: [] };

function record(reply: unknown = EMPTY) {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    return reply;
  });
  return calls;
}

describe("catalog.fetchPage", () => {
  it("sends one catalog_page call with the raw query, page and genre", async () => {
    const calls = record();
    await catalog.fetchPage("movie", "heat ", 2, 28);
    expect(calls).toEqual([
      { cmd: "catalog_page", args: { media_type: "movie", query: "heat ", page: 2, genre: 28 } },
    ]);
  });

  it("sends genre: null when no genre is selected", async () => {
    const calls = record();
    await catalog.fetchPage("book", "", 1, null);
    expect(calls[0].args).toEqual({ media_type: "book", query: "", page: 1, genre: null });
  });

  it("returns the Rust page unchanged", async () => {
    const page = { ...EMPTY, total_pages: 3 };
    record(page);
    await expect(catalog.fetchPage("game", "", 1, "rpg")).resolves.toEqual(page);
  });
});

describe("catalog.fetchDetail", () => {
  it("passes the URL segments to Rust, which validates them", async () => {
    const calls = record({});
    await catalog.fetchDetail("book", "abc%2F1");
    expect(calls).toEqual([{ cmd: "catalog_detail", args: { media_type: "book", id: "abc/1" } }]);
  });

  it("surfaces the Rust rejection message", async () => {
    mockIPC(() => Promise.reject("Invalid ID."));
    await expect(catalog.fetchDetail("movie", "abc")).rejects.toBe("Invalid ID.");
  });
});

describe("catalog.fetchGenres", () => {
  it("asks Rust for the genres of one media type", async () => {
    const genres = [{ id: "romance", name: "Romance" }];
    const calls = record(genres);
    await expect(catalog.fetchGenres("book")).resolves.toEqual(genres);
    expect(calls).toEqual([{ cmd: "catalog_genres", args: { media_type: "book" } }]);
  });
});

describe("catalog online reporting", () => {
  it("an offline-marked rejection flips the app offline and still rejects", async () => {
    mockIPC(() => Promise.reject("offline: error sending request"));
    await expect(catalog.fetchGenres("movie")).rejects.toBe("offline: error sending request");
    expect(onlineStore.online).toBe(false);
  });

  it("the next success brings it back online", async () => {
    mockIPC(() => Promise.reject("offline: error sending request"));
    await catalog.fetchGenres("movie").catch(() => {});
    record([]);
    await catalog.fetchGenres("movie");
    expect(onlineStore.online).toBe(true);
  });
});
