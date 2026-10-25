import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import MatchSheet from "./MatchSheet.svelte";
import { MatchStore } from "$lib/stores/match.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { emptyLength } from "$lib/domain/length";
import type { Catalog } from "$lib/api/catalog";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaDetail, MediaItem } from "$lib/types/media";

const KEY = "manual:book:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";
const MINE = {
  key: KEY,
  snapshot: {
    media_key: KEY,
    provider: "manual",
    media_type: "book",
    title: "Piranesi",
    poster_path: null,
    poster_file: null,
    year: null,
  },
  user: {
    status: "in_progress",
    progress: 40,
    rating: 8,
    review: null,
    length: { ...emptyLength(), pages: 272 },
    plan: null,
  },
  created_at: "t",
  updated_at: "t",
} as LibraryEntry;

function hit(id: number, title = `Piranesi ${id}`): MediaItem {
  return {
    id,
    provider: "itunes",
    media_key: `itunes:book:${id}`,
    title,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    release_date: "2020-09-15",
    media_type: "book",
  };
}

const MERGED = {
  ...MINE,
  key: "itunes:book:1",
  snapshot: { ...MINE.snapshot, media_key: "itunes:book:1", provider: "itunes", year: "2020" },
} as LibraryEntry;

function setup(
  catalog: Partial<Catalog> = {},
  client: Partial<LibraryClient> = {},
  results: MediaItem[] = [hit(1), hit(2)],
) {
  const library = new LibraryStore({
    load: vi.fn(async () => [MINE]),
    posterDir: vi.fn(async () => null),
    mergePreview: vi.fn(async () => ({ entry: MERGED, combined: false })),
    merge: vi.fn(async () => MERGED),
    unmerge: vi.fn(),
    ...client,
  } as unknown as LibraryClient);
  const fake = {
    fetchPage: vi.fn(async () => ({
      results,
      page: 1,
      total_pages: 1,
      total_results: results.length,
    })),
    fetchDetail: vi.fn(async () => ({ media_type: "book" }) as MediaDetail),
    fetchGenres: vi.fn(),
    ...catalog,
  } as unknown as Catalog;
  const match = new MatchStore(vi.fn());
  render(MatchSheet, { match, library, catalog: fake });
  return { library, match, catalog: fake, user: userEvent.setup() };
}

async function opened(s: ReturnType<typeof setup>) {
  await s.library.hydrate();
  s.match.open(MINE);
  return screen.findByRole("dialog", { name: "Find a match for Piranesi" });
}

describe("MatchSheet", () => {
  it("shows nothing until a page opens it", () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("searches the item's own type for its title right away", async () => {
    const s = setup();
    await opened(s);
    expect(screen.getByRole("searchbox", { name: "Search the catalog" })).toHaveValue("Piranesi");
    expect(s.catalog.fetchPage).toHaveBeenCalledWith("book", "Piranesi", 1, null);
    expect(await screen.findAllByRole("button", { name: /^Piranesi \d/ })).toHaveLength(2);
  });

  it("shows at most eight results", async () => {
    await opened(
      setup(
        {},
        {},
        Array.from({ length: 12 }, (_, i) => hit(i + 1)),
      ),
    );
    const list = await screen.findByRole("list", { name: "Catalog results" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
  });

  it("searches again for what the user typed", async () => {
    const s = setup();
    await opened(s);
    const box = screen.getByRole("searchbox", { name: "Search the catalog" });
    await s.user.clear(box);
    await s.user.type(box, "House of Leaves{Enter}");
    expect(s.catalog.fetchPage).toHaveBeenLastCalledWith("book", "House of Leaves", 1, null);
  });

  it("says so when nothing matches", async () => {
    await opened(setup({}, {}, []));
    expect(await screen.findByText("No match found")).toBeInTheDocument();
  });

  it("shows a failed search with a retry", async () => {
    const fetchPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("timed out"))
      .mockResolvedValue({ results: [hit(1)], page: 1, total_pages: 1, total_results: 1 });
    const s = setup({ fetchPage });
    await opened(s);
    expect(await screen.findByRole("alert")).toHaveTextContent("timed out");
    await s.user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /^Piranesi 1\b/ })).toBeInTheDocument();
  });

  it("shows yours → the catalog's, lists what changes and what stays", async () => {
    const detail = { media_type: "book", runtime: null } as unknown as MediaDetail;
    const s = setup({ fetchDetail: vi.fn(async () => detail) });
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    const changes = await screen.findByRole("list", { name: "What changes" });
    const rows = within(changes).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Year");
    expect(rows[0]).toHaveTextContent("was empty");
    expect(rows[0]).toHaveTextContent("now 2020");
    expect(
      screen.getByText("Kept as is: Title, Pages, Status, Progress, Rating"),
    ).toBeInTheDocument();
    expect(screen.getByText("Apple Books")).toBeInTheDocument();
    expect(screen.getByText("Piranesi 1")).toBeInTheDocument();
    expect(s.catalog.fetchDetail).toHaveBeenCalledWith("book", "1");
  });

  it("says when progress stopped at the new end and the item finished", async () => {
    const capped = {
      ...MERGED,
      user: {
        ...MERGED.user,
        status: "completed",
        progress: 30,
        length: { ...emptyLength(), pages: 30 },
      },
    } as LibraryEntry;
    const s = setup({}, { mergePreview: vi.fn(async () => ({ entry: capped, combined: false })) });
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    expect(
      await screen.findByText(/stops at the end and the item is marked Completed/),
    ).toBeInTheDocument();
  });

  it("shows each side's title, length and type · year, with a replaced length struck", async () => {
    const mine = {
      ...MINE,
      snapshot: { ...MINE.snapshot, media_type: "manga", title: "nagatoro", year: "2017" },
      user: {
        ...MINE.user,
        progress: 0,
        length: { ...emptyLength(), chapters: 666, chapter_minutes: 22 },
      },
    } as LibraryEntry;
    const merged = {
      ...mine,
      key: "anilist:manga:100664",
      snapshot: {
        ...mine.snapshot,
        media_key: "anilist:manga:100664",
        provider: "anilist",
        title: "Nagatoro",
      },
      user: { ...mine.user, length: { ...emptyLength(), chapters: 189, chapter_minutes: 22 } },
    } as LibraryEntry;
    const manga = {
      ...hit(100664, "Nagatoro"),
      provider: "anilist",
      media_key: "anilist:manga:100664",
      media_type: "manga",
      release_date: "2017-08-09",
    } as MediaItem;
    const s = setup({}, { mergePreview: vi.fn(async () => ({ entry: merged, combined: false })) }, [
      manga,
    ]);
    await s.library.hydrate();
    s.match.open(mine);
    await s.user.click(await screen.findByRole("button", { name: /^Nagatoro/ }));

    const yours = await screen.findByRole("figure", { name: "Yours" });
    expect(yours).toHaveTextContent("nagatoro");
    expect(yours).toHaveTextContent("666 chapters");
    expect(yours).toHaveTextContent("Manga · 2017");
    expect(yours.querySelector("s")).toBeNull();

    const theirs = screen.getByRole("figure", { name: "AniList" });
    expect(theirs).toHaveTextContent("Nagatoro");
    expect(theirs).toHaveTextContent("Manga · 2017");
    // The struck and bold values carry hidden "was" / "now" words for screen readers.
    expect(theirs.querySelector("s")).toHaveTextContent("666 chapters");
    expect(theirs.querySelector("strong")).toHaveTextContent("189 chapters");

    const changes = screen.getByRole("list", { name: "What changes" });
    expect(changes).toHaveTextContent(/Chapters.*666.*189/);
  });

  it("shows a length the match keeps plainly, not struck", async () => {
    const s = setup();
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    const theirs = await screen.findByRole("figure", { name: "Apple Books" });
    expect(within(theirs).getByText("272 pages")).toBeInTheDocument();
    expect(theirs.querySelector("s")).toBeNull();
  });

  it("warns that an item already in the library will be combined", async () => {
    const s = setup({}, { mergePreview: vi.fn(async () => ({ entry: MERGED, combined: true })) });
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    expect(await screen.findByText(/You already have this/)).toBeInTheDocument();
  });

  it("shows the reason in place of Use this when the match would be refused", async () => {
    const reason = "a match must be the same type";
    const s = setup(
      {},
      {
        mergePreview: vi.fn(async () => {
          throw reason;
        }),
      },
    );
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(reason);
    expect(screen.queryByRole("button", { name: "Use this" })).toBeNull();
  });

  it("Back returns to the same results without searching again", async () => {
    const s = setup();
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    await s.user.click(await screen.findByRole("button", { name: "Back to results" }));
    expect(await screen.findByRole("button", { name: /^Piranesi 2\b/ })).toBeInTheDocument();
    expect(s.catalog.fetchPage).toHaveBeenCalledOnce();
  });

  it("Use this merges, closes and hands the result to the store", async () => {
    const merge = vi.fn(async () => MERGED);
    const s = setup({}, { merge });
    const merged = vi.spyOn(s.match, "merged");
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    await s.user.click(await screen.findByRole("button", { name: "Use this" }));
    await vi.waitFor(() => expect(merged).toHaveBeenCalledWith(MERGED));
    expect(merge).toHaveBeenCalledWith(KEY, hit(1), emptyLength(), { media_type: "book" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(s.library.get(MERGED.key)).toEqual(MERGED);
  });

  it("uses the same fetched metadata for preview and saving", async () => {
    const detail = {
      media_key: "itunes:book:1",
      media_type: "book",
      title: "Catalog title",
      overview: "Fresh catalog overview",
      author: "Catalog author",
      genres: [{ id: 1, name: "Fantasy" }],
      platforms: ["Library"],
      poster_path: "https://example.com/poster.jpg",
      runtime: null,
    } as MediaDetail;
    const preview = vi.fn(async () => ({ entry: MERGED, combined: false }));
    const merge = vi.fn(async () => MERGED);
    const s = setup({ fetchDetail: vi.fn(async () => detail) }, { mergePreview: preview, merge });
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    expect(preview).toHaveBeenCalledWith(KEY, hit(1), emptyLength(), detail);
    await s.user.click(screen.getByRole("button", { name: "Use this" }));
    expect(merge).toHaveBeenCalledWith(KEY, hit(1), emptyLength(), detail);
    expect(s.catalog.fetchDetail).toHaveBeenCalledOnce();
  });

  it("keeps the sheet open with the reason when the merge fails", async () => {
    const s = setup(
      {},
      {
        merge: vi.fn(async () => {
          throw "disk full";
        }),
      },
    );
    await opened(s);
    await s.user.click(await screen.findByRole("button", { name: /^Piranesi 1\b/ }));
    await s.user.click(await screen.findByRole("button", { name: "Use this" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers Undo once the match is made, and says why a refused undo failed", async () => {
    const s = setup();
    s.match.notice = { manual: MINE, into: MERGED };
    const toast = await screen.findByRole("status", { name: "Matched" });
    expect(toast).toHaveTextContent("Matched to Piranesi");
    const undo = vi.spyOn(s.match, "undo").mockImplementation(async () => {
      s.match.notice = null;
      s.match.error = "it changed after the match, so the match can't be undone";
    });
    await s.user.click(within(toast).getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledWith(s.library);
    expect(await screen.findByRole("status", { name: "Matched" })).toHaveTextContent(
      "changed after the match",
    );
  });
});
