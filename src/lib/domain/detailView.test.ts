import { describe, expect, it } from "vitest";
import { detailSource, entryForRoute, snapshotItem } from "./detailView";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaDetail } from "$lib/types/media";

const saved = { key: "tmdb:movie:1", snapshot: { media_type: "movie" } } as LibraryEntry;
const detail = { media_key: "tmdb:movie:1" } as MediaDetail;

describe("entryForRoute", () => {
  it("matches type and id, ignoring the provider", () => {
    expect(entryForRoute([saved], "movie", "1")).toBe(saved);
    expect(entryForRoute([saved], "tv", "1")).toBeUndefined();
    expect(entryForRoute([saved], "movie", "10")).toBeUndefined();
  });

  it("keeps colons inside ids", () => {
    const odd = { key: "itunes:book:a:b", snapshot: { media_type: "book" } } as LibraryEntry;
    expect(entryForRoute([odd], "book", "a:b")).toBe(odd);
  });
});

describe("detailSource", () => {
  it("prefers the provider's detail", () => {
    expect(detailSource({ loading: false, detail, error: "", entry: saved })).toEqual({
      kind: "detail",
      detail,
    });
  });

  it("falls back to the saved copy when the fetch failed", () => {
    expect(detailSource({ loading: false, detail: null, error: "offline", entry: saved })).toEqual({
      kind: "saved",
      entry: saved,
    });
  });

  it("shows the error for an unsaved item", () => {
    expect(
      detailSource({ loading: false, detail: null, error: "offline", entry: undefined }),
    ).toEqual({ kind: "error", message: "offline" });
  });

  it("is loading while the fetch runs", () => {
    expect(detailSource({ loading: true, detail: null, error: "", entry: saved })).toEqual({
      kind: "loading",
    });
  });
});

describe("snapshotItem", () => {
  it("rebuilds a catalog item from the saved copy", () => {
    const item = snapshotItem({
      media_key: "itunes:book:a:b",
      provider: "itunes",
      media_type: "book",
      title: "A book",
      poster_path: "https://img/x.jpg",
      poster_file: null,
      year: "2020",
    });
    expect(item).toMatchObject({
      id: "a:b",
      provider: "itunes",
      media_key: "itunes:book:a:b",
      media_type: "book",
      title: "A book",
      poster_path: "https://img/x.jpg",
      release_date: "2020",
    });
  });
});
