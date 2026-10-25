import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SaveToLibrary from "./SaveToLibrary.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { emptyLength } from "$lib/domain/length";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaDetail, MediaItem } from "$lib/types/media";

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
    poster_file: null,
  },
  user: {
    status: "planning",
    progress: 0,
    rating: null,
    review: null,
    length: emptyLength(),
    plan: null,
  },
  created_at: "t",
  updated_at: "t",
};

function storeWith(over: Partial<LibraryClient> = {}) {
  const client: LibraryClient = {
    load: vi.fn(async () => []),
    add: vi.fn(async () => SAVED),
    update: vi.fn(async () => SAVED),
    plan: vi.fn(async () => SAVED),
    remove: vi.fn(async () => true),
    posterDir: vi.fn(async () => "/data/posters"),
    retryPosters: vi.fn(async () => {}),
    addManual: vi.fn(),
    editManual: vi.fn(),
    mergePreview: vi.fn(),
    merge: vi.fn(),
    unmerge: vi.fn(),
    retypeManual: vi.fn(),
    ...over,
  };
  return { store: new LibraryStore(client), client };
}

describe("SaveToLibrary", () => {
  it("adds a manga with its minutes per chapter from Settings", async () => {
    const { store, client } = storeWith();
    const prefs = new PrefsStore({
      load: vi.fn(async () => ({ ...DEFAULT_PREFS, manga_chapter_minutes: 22 })),
      update: vi.fn(),
    } as never);
    await prefs.hydrate();
    const manga = { ...ITEM, media_key: "anilist:manga:7", media_type: "manga" } as MediaItem;
    render(SaveToLibrary, { item: manga, store, prefs });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    expect(screen.getByLabelText("Minutes per chapter")).toHaveValue(22);
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(vi.mocked(client.add).mock.calls[0][1]).toMatchObject({
      length: { chapter_minutes: 22 },
    });
  });

  it("offers to add an item that is not saved", () => {
    const { store } = storeWith();
    render(SaveToLibrary, { item: ITEM, store });
    expect(screen.getByRole("button", { name: /add to library/i })).toBeInTheDocument();
  });

  it("saves on click as Planning and hides the add button", async () => {
    const { store, client } = storeWith();
    render(SaveToLibrary, { item: ITEM, store });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    await userEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(client.add).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(screen.queryByRole("button", { name: /add to library/i })).toBeNull(),
    );
    expect(store.get("tmdb:tv:7")?.user.status).toBe("planning");
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

  it("reopens the sheet for a saved item and patches only length and review", async () => {
    const { store, client } = storeWith({ load: vi.fn(async () => [SAVED]) });
    await store.hydrate();
    render(SaveToLibrary, { item: ITEM, store, editing: true });

    const sheet = screen.getByRole("dialog", { name: /^edit /i });
    expect(sheet.contains(document.activeElement)).toBe(true);
    expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^episodes/i), "9");
    await userEvent.click(screen.getByRole("button", { name: /^save/i }));

    expect(client.update).toHaveBeenCalledWith("tmdb:tv:7", {
      length: expect.objectContaining({ episodes: 9 }),
      review: null,
    });
  });

  it("opens the length sheet on itself, not a field, so a phone keyboard stays down", async () => {
    const { store } = storeWith({ load: vi.fn(async () => [SAVED]) });
    await store.hydrate();
    render(SaveToLibrary, { item: ITEM, store, editing: true });
    expect(screen.getByRole("dialog", { name: /^edit /i })).toHaveFocus();
    expect(screen.getByLabelText(/^episodes/i)).not.toHaveFocus();
  });

  it("fills a saved item's missing length from the catalog, keeping what was typed", async () => {
    const typed = { ...SAVED, user: { ...SAVED.user, length: { ...emptyLength(), episodes: 10 } } };
    const { store } = storeWith({ load: vi.fn(async () => [typed]) });
    await store.hydrate();
    const detail = { ...ITEM, episodes: 48, runtime: 24 } as unknown as MediaDetail;
    render(SaveToLibrary, { item: ITEM, store, editing: true, detail });
    expect(screen.getByLabelText(/^episodes/i)).toHaveValue(10);
    expect(screen.getByLabelText(/^minutes per episode/i)).toHaveValue(24);
  });

  it("closes the sheet on Escape without saving", async () => {
    const { store, client } = storeWith();
    render(SaveToLibrary, { item: ITEM, store });
    await userEvent.click(screen.getByRole("button", { name: /add to library/i }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();
  });
});
