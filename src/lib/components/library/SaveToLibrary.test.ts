import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SaveToLibrary from "./SaveToLibrary.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaItem } from "$lib/types/media";

const ITEM = {
  id: 7,
  provider: "tmdb",
  media_key: "tmdb:tv:7",
  media_type: "tv",
  title: "Arcane",
  overview: "",
  poster_path: null,
  backdrop_path: null,
  vote_average: 0,
  vote_count: 0,
} as unknown as MediaItem;

const SAVED: LibraryEntry = {
  key: "tmdb:tv:7",
  snapshot: {
    media_key: "tmdb:tv:7",
    provider: "tmdb",
    media_type: "tv",
    title: "Arcane",
    poster_path: null,
    year: null,
  },
  user: { status: "planning", progress: 0, rating: null, review: null, length: emptyLength() },
  created_at: "t",
  updated_at: "t",
};

function storeWith(over: Partial<LibraryClient> = {}) {
  const client: LibraryClient = {
    load: vi.fn(async () => []),
    add: vi.fn(async () => SAVED),
    update: vi.fn(async () => SAVED),
    remove: vi.fn(async () => true),
    ...over,
  };
  return { store: new LibraryStore(client), client };
}

describe("SaveToLibrary", () => {
  it("offers to add an item that is not saved", () => {
    const { store } = storeWith();
    render(SaveToLibrary, { item: ITEM, store });
    expect(screen.getByRole("button", { name: /add to library/i })).toBeInTheDocument();
  });

  it("saves on click and shows the resulting status", async () => {
    const { store, client } = storeWith();
    render(SaveToLibrary, { item: ITEM, store });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    await userEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(client.add).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText(/status/i)).toHaveValue("planning");
  });

  it("shows the error and the add button again when the save fails", async () => {
    const { store } = storeWith({
      add: vi.fn(async () => {
        throw new Error("disk full");
      }),
    });
    render(SaveToLibrary, { item: ITEM, store });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    await userEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(await screen.findByText(/disk full/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to library/i })).toBeInTheDocument();
  });

  it("changes the status of a saved entry", async () => {
    const { store, client } = storeWith({ load: vi.fn(async () => [SAVED]) });
    await store.hydrate();
    render(SaveToLibrary, { item: ITEM, store });
    await userEvent.selectOptions(screen.getByLabelText(/status/i), "completed");
    expect(client.update).toHaveBeenCalledWith("tmdb:tv:7", { status: "completed" });
  });

  it("removes a saved entry", async () => {
    const { store, client } = storeWith({ load: vi.fn(async () => [SAVED]) });
    await store.hydrate();
    render(SaveToLibrary, { item: ITEM, store });
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(client.remove).toHaveBeenCalledWith("tmdb:tv:7");
  });

  it("opens the add sheet instead of saving straight away", async () => {
    const { store, client } = storeWith();
    render(SaveToLibrary, { item: ITEM, store, detail: null });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();
  });

  it("saves with the length the sheet collected", async () => {
    const { store, client } = storeWith();
    render(SaveToLibrary, { item: ITEM, store, detail: null });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    await userEvent.type(screen.getByLabelText(/minutes per episode/i), "40");
    await userEvent.click(screen.getByRole("button", { name: /^save/i }));
    expect(client.add).toHaveBeenCalledWith(ITEM, {
      length: { ...emptyLength(), episode_minutes: 40 },
      review: null,
    });
  });

  it("saves nothing when the sheet is cancelled", async () => {
    const { store, client } = storeWith();
    render(SaveToLibrary, { item: ITEM, store, detail: null });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();
  });
});
