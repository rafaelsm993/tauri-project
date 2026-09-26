import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LibraryPage from "./LibraryView.svelte";
import { LibraryStore } from "$lib/stores/library.svelte";
import { LibraryFilters } from "$lib/stores/ui.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entry(id: number, type: MediaType, status: LibraryStatus): LibraryEntry {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: `T${id}`,
      poster_path: null,
      year: null,
      poster_file: null,
    },
    user: { status, progress: 0, rating: null, review: null, length: emptyLength() },
    created_at: "t",
    updated_at: `2026-09-2${id}T00:00:00Z`,
  };
}

async function storeWith(list: LibraryEntry[]) {
  const store = new LibraryStore({
    load: vi.fn(async () => list),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    posterDir: vi.fn(async () => "/data/posters"),
    retryPosters: vi.fn(async () => {}),
  });
  await store.hydrate();
  return store;
}

const search = () => screen.getByRole("searchbox", { name: "Search your library" });
const cards = () => screen.queryAllByRole("link", { name: /\bT\d\b/ });

describe("LibraryView", () => {
  it("shows the empty state with a way to browse", async () => {
    render(LibraryPage, { store: await storeWith([]), filters: new LibraryFilters() });
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse/i })).toHaveAttribute("href", "/");
  });

  it("filters the grid by status and type", async () => {
    const store = await storeWith([
      entry(1, "movie", "planning"),
      entry(2, "tv", "in_progress"),
      entry(3, "tv", "planning"),
    ]);
    render(LibraryPage, { store, filters: new LibraryFilters() });
    expect(cards()).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /^planning/i }));
    expect(cards()).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /^tv/i }));
    expect(cards().map((a) => a.textContent)).toEqual([expect.stringContaining("T3")]);
  });

  it("says when a filter matches nothing", async () => {
    render(LibraryPage, {
      store: await storeWith([entry(1, "movie", "planning")]),
      filters: new LibraryFilters(),
    });
    await userEvent.click(screen.getByRole("button", { name: /^dropped/i }));
    expect(screen.getByText(/no dropped items/i)).toBeInTheDocument();
  });

  it("narrows the grid by title as you type, with counts that follow", async () => {
    const store = await storeWith([
      entry(1, "movie", "planning"),
      entry(2, "tv", "in_progress"),
      entry(3, "tv", "planning"),
    ]);
    render(LibraryPage, { store, filters: new LibraryFilters() });
    await userEvent.type(search(), "t2");
    expect(cards().map((a) => a.textContent)).toEqual([expect.stringContaining("T2")]);
    const status = within(screen.getByRole("group", { name: "Status" }));
    expect(status.getByRole("button", { name: /^all 1/i })).toBeInTheDocument();
    expect(status.getByRole("button", { name: /^planning 0/i })).toBeInTheDocument();
  });

  it("says when no title matches and clearing restores the grid", async () => {
    const store = await storeWith([entry(1, "movie", "planning"), entry(2, "tv", "planning")]);
    render(LibraryPage, { store, filters: new LibraryFilters() });
    await userEvent.type(search(), "zzz");
    expect(cards()).toHaveLength(0);
    expect(screen.getByText("No titles match \u201czzz\u201d.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(cards()).toHaveLength(2);
  });

  it("keeps the search and filters when you come back", async () => {
    const store = await storeWith([entry(1, "movie", "planning"), entry(2, "tv", "planning")]);
    const filters = new LibraryFilters();
    const first = render(LibraryPage, { store, filters });
    await userEvent.type(search(), "t1");
    first.unmount();
    render(LibraryPage, { store, filters });
    expect(search()).toHaveValue("t1");
    expect(cards()).toHaveLength(1);
  });

  it("falls back to all types when the kept type is no longer in the library", async () => {
    const store = await storeWith([
      entry(1, "movie", "planning"),
      entry(2, "tv", "planning"),
      entry(3, "game", "planning"),
    ]);
    const filters = new LibraryFilters();
    filters.type = "anime";
    render(LibraryPage, { store, filters });
    expect(cards()).toHaveLength(3);
    const type = within(screen.getByRole("group", { name: "Type" }));
    expect(type.getByRole("button", { name: /^all 3/i, pressed: true })).toBeInTheDocument();
  });
});
