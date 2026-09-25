import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LibraryPage from "./LibraryView.svelte";
import { LibraryStore } from "$lib/stores/library.svelte";
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
  });
  await store.hydrate();
  return store;
}

const cards = () => screen.queryAllByRole("link", { name: /\bT\d\b/ });

describe("LibraryView", () => {
  it("shows the empty state with a way to browse", async () => {
    render(LibraryPage, { store: await storeWith([]) });
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
    render(LibraryPage, { store });
    expect(cards()).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /^planning/i }));
    expect(cards()).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /^tv/i }));
    expect(cards().map((a) => a.textContent)).toEqual([expect.stringContaining("T3")]);
  });

  it("says when a filter matches nothing", async () => {
    render(LibraryPage, { store: await storeWith([entry(1, "movie", "planning")]) });
    await userEvent.click(screen.getByRole("button", { name: /^dropped/i }));
    expect(screen.getByText(/no dropped items/i)).toBeInTheDocument();
  });
});
