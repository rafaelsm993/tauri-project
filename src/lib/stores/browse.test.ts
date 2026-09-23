import { describe, expect, it, vi } from "vitest";
import type { Catalog } from "$lib/api/catalog";
import type { GenreId, GenreOption, MediaItem, MediaType } from "$lib/types/media";
import { BrowseStore } from "./browse.svelte";

const item = (id: number): MediaItem => ({
  id,
  provider: "tmdb",
  media_key: `tmdb:movie:${id}`,
  title: `T${id}`,
  overview: "",
  poster_path: null,
  backdrop_path: null,
  vote_average: 0,
  vote_count: 0,
  media_type: "movie",
});
const genres = (n: number): GenreOption[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `G${i + 1}` }));
const page = (ids: number[], total_pages = 1) => ({
  results: ids.map(item),
  page: 1,
  total_pages,
  total_results: ids.length,
});

function fakeCatalog(over: Partial<Catalog> = {}): Catalog {
  return {
    fetchGenres: vi.fn(async () => genres(10)),
    fetchPage: vi.fn(async () => page([1, 2])),
    fetchDetail: vi.fn(),
    ...over,
  } as Catalog;
}

describe("BrowseStore", () => {
  it("refreshView: one idle section per genre, no page fetched until a section asks", async () => {
    const cat = fakeCatalog();
    const s = new BrowseStore(cat);
    await s.refreshView();
    expect(s.carouselMode).toBe(true);
    expect(s.sections.map((x) => x.genre.id)).toEqual(genres(10).map((g) => g.id));
    expect(s.sections.every((x) => x.loading && x.items.length === 0)).toBe(true);
    expect(cat.fetchPage).not.toHaveBeenCalled();
    await s.refreshView();
    expect(cat.fetchGenres).toHaveBeenCalledTimes(1);
  });

  it("loadSection: fetches that genre once, however often it is asked", async () => {
    const cat = fakeCatalog();
    const s = new BrowseStore(cat);
    await s.refreshView();
    await Promise.all([s.loadSection(7), s.loadSection(7)]);
    await s.loadSection(7);
    expect(cat.fetchPage).toHaveBeenCalledTimes(1);
    expect(cat.fetchPage).toHaveBeenCalledWith("movie", "", 1, 7);
    const sec = s.sections.find((x) => x.genre.id === 7)!;
    expect(sec.loading).toBe(false);
    expect(sec.items).toHaveLength(2);
    expect(s.sections.filter((x) => !x.loading)).toHaveLength(1);
  });

  it("genre selection filters the rendered sections and resets on category switch", async () => {
    const s = new BrowseStore(fakeCatalog());
    await s.refreshView();
    expect(s.genreOptions).toEqual(genres(10).map((g) => ({ value: g.id, label: g.name })));
    expect(s.visibleSections).toHaveLength(10);

    s.setSelectedGenres([3, 1]);
    expect(s.visibleSections.map((x) => x.genre.id)).toEqual([1, 3]);

    await s.switchCategory("tv");
    expect(s.selectedGenres).toEqual([]);
    expect(s.visibleSections).toHaveLength(10);
  });

  it("a failing carousel shows its own error; the others still load", async () => {
    const cat = fakeCatalog({
      fetchPage: vi.fn(async (_c: MediaType, _q: string, _p: number, g: GenreId | null) => {
        if (g === 1) throw "HTTP 429";
        return page([1]);
      }),
    });
    const s = new BrowseStore(cat);
    await s.refreshView();
    await Promise.all([s.loadSection(1), s.loadSection(2)]);
    expect(s.sections[0].error).toBe("HTTP 429");
    expect(s.sections[1].items).toHaveLength(1);
  });

  it("retrySection: refetches a failed carousel", async () => {
    let fail = true;
    const cat = fakeCatalog({
      fetchPage: vi.fn(async () => {
        if (fail) throw "HTTP 429";
        return page([9]);
      }),
    });
    const s = new BrowseStore(cat);
    await s.refreshView();
    await s.loadSection(1);
    expect(s.sections[0].error).toBe("HTTP 429");
    fail = false;
    await s.retrySection(1);
    expect(s.sections[0]).toMatchObject({ error: "", loading: false });
    expect(s.sections[0].items.map((i) => i.id)).toEqual([9]);
    expect(cat.fetchPage).toHaveBeenCalledTimes(2);
  });

  it("falls back to a flat grid when a category has no genres", async () => {
    const s = new BrowseStore(fakeCatalog({ fetchGenres: vi.fn(async () => []) }));
    await s.refreshView();
    expect(s.sections).toEqual([]);
    expect(s.items).toHaveLength(2);
  });

  it("search: switches to grid mode and clears the genre", async () => {
    const cat = fakeCatalog();
    const s = new BrowseStore(cat);
    s.activeGenre = 3;
    await s.search("heat");
    expect(s.isSearch).toBe(true);
    expect(s.activeGenre).toBeNull();
    expect(s.carouselMode).toBe(false);
    expect(cat.fetchPage).toHaveBeenLastCalledWith("movie", "heat", 1, null);
  });

  it("clearSearch: back to carousels", async () => {
    const s = new BrowseStore(fakeCatalog());
    await s.search("heat");
    await s.clearSearch();
    expect(s.isSearch).toBe(false);
    expect(s.carouselMode).toBe(true);
    expect(s.sections.length).toBeGreaterThan(0);
  });

  it("loadMore: appends the next page and stops at the last page", async () => {
    const cat = fakeCatalog({
      fetchPage: vi.fn(async (_c: MediaType, _q: string, p: number) => page([p * 10], 2)),
    });
    const s = new BrowseStore(cat);
    await s.search("x");
    expect(s.hasMore).toBe(true);
    await s.loadMore();
    expect(s.items.map((i) => i.id)).toEqual([10, 20]);
    expect(s.hasMore).toBe(false);
    await s.loadMore();
    expect(cat.fetchPage).toHaveBeenCalledTimes(2);
  });

  it("loadMore: drops items the provider repeats across pages", async () => {
    const cat = fakeCatalog({
      fetchPage: vi.fn(async (_c: MediaType, _q: string, p: number) =>
        page(p === 1 ? [1, 2, 3] : [3, 4, 2], 2),
      ),
    });
    const s = new BrowseStore(cat);
    await s.search("x");
    await s.loadMore();
    expect(s.items.map((i) => i.media_key)).toEqual([
      "tmdb:movie:1",
      "tmdb:movie:2",
      "tmdb:movie:3",
      "tmdb:movie:4",
    ]);
  });

  it("loadMore: a page with nothing new ends pagination instead of looping", async () => {
    const cat = fakeCatalog({ fetchPage: vi.fn(async () => page([1, 2, 3], 99)) });
    const s = new BrowseStore(cat);
    await s.search("x");
    const before = s.items;
    await s.loadMore();
    expect(s.items).toBe(before);
    expect(s.hasMore).toBe(false);
    await s.loadMore();
    expect(cat.fetchPage).toHaveBeenCalledTimes(2);
  });

  it("loadMore: a late page from the previous category is dropped", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const cat = fakeCatalog({
      fetchGenres: vi.fn(async () => []),
      fetchPage: vi.fn(async (c: MediaType, _q: string, p: number) => {
        if (c === "movie" && p === 2) await gate;
        return page(c === "movie" ? [p * 10] : [7], 2);
      }),
    });
    const s = new BrowseStore(cat);
    await s.search("x");
    const late = s.loadMore();
    await s.switchCategory("tv");
    release();
    await late;
    expect(s.activeCategory).toBe("tv");
    expect(s.items.map((i) => i.id)).toEqual([7]);
  });

  it("grid and carousels drop duplicates within one page", async () => {
    const cat = fakeCatalog({ fetchPage: vi.fn(async () => page([5, 5, 6])) });
    const s = new BrowseStore(cat);
    await s.search("x");
    expect(s.items.map((i) => i.id)).toEqual([5, 6]);
    await s.clearSearch();
    await s.loadSection(1);
    expect(s.sections[0].items.map((i) => i.id)).toEqual([5, 6]);
  });

  it("grid errors are user-facing strings", async () => {
    const s = new BrowseStore(
      fakeCatalog({ fetchPage: vi.fn(async () => Promise.reject("Invalid API key")) }),
    );
    await s.search("x");
    expect(s.error).toBe("Invalid API key");
  });

  it("switchCategory: resets genre and ignores late results from the old category", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const cat = fakeCatalog({
      fetchPage: vi.fn(async (c: MediaType) => {
        if (c === "movie") await gate;
        return page([c === "movie" ? 1 : 2]);
      }),
    });
    const s = new BrowseStore(cat);
    await s.refreshView();
    const late = s.loadSection(1);
    await vi.waitFor(() => expect(cat.fetchPage).toHaveBeenCalledWith("movie", "", 1, 1));
    s.activeGenre = 5;
    await s.switchCategory("anime");
    await s.loadSection(1);
    release();
    await late;
    expect(s.activeCategory).toBe("anime");
    expect(s.activeGenre).toBeNull();
    const ids = s.sections.flatMap((x) => x.items.map((i) => i.id));
    expect(ids).toEqual([2]);
  });

  it("switchGenre to the same id is a no-op", async () => {
    const cat = fakeCatalog();
    const s = new BrowseStore(cat);
    await s.switchGenre(null);
    expect(cat.fetchGenres).not.toHaveBeenCalled();
  });
});
