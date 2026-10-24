import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ManualEntrySheet from "./ManualEntrySheet.svelte";
import { ManualEntryStore } from "$lib/stores/manualEntry.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";

const KEY = "manual:book:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";
const DUNE = {
  key: KEY,
  snapshot: {
    media_key: KEY,
    provider: "manual",
    media_type: "book",
    title: "Dune",
    poster_path: null,
    poster_file: null,
    year: null,
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
} as LibraryEntry;

function setup(client: Partial<LibraryClient> = {}, saved: LibraryEntry[] = []) {
  const library = new LibraryStore({
    load: vi.fn(async () => saved),
    posterDir: vi.fn(async () => null),
    addManual: vi.fn(async () => DUNE),
    editManual: vi.fn(async () => ({ ...DUNE, snapshot: { ...DUNE.snapshot, title: "X" } })),
    ...client,
  } as unknown as LibraryClient);
  const entry = new ManualEntryStore(vi.fn());
  render(ManualEntrySheet, { entry, library });
  return { library, entry, user: userEvent.setup() };
}

describe("ManualEntrySheet", () => {
  it("shows nothing until a button opens it", () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens prefilled, and saving adds the item and hands it to the store", async () => {
    const { library, entry, user } = setup();
    const saved = vi.spyOn(entry, "saved");
    entry.open({ type: "book", title: "Dune" });
    await screen.findByRole("dialog", { name: "Add manually" });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saved).toHaveBeenCalledWith(DUNE));
    expect(library.get(KEY)).toEqual(DUNE);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the sheet open with the reason when the save is refused", async () => {
    const { entry, user } = setup({
      addManual: vi.fn(async () => {
        throw new Error("disk full");
      }),
    });
    entry.open({ type: "book", title: "Dune" });
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText(/disk full/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("edits the saved item it was opened for", async () => {
    const editManual = vi.fn(async () => DUNE);
    const { library, entry, user } = setup({ editManual }, [DUNE]);
    await library.hydrate();
    entry.open({ type: "book", edit: KEY });
    await screen.findByRole("dialog", { name: "Edit Dune" });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(editManual).toHaveBeenCalledOnce());
    expect(editManual.mock.calls[0]).toEqual([KEY, expect.objectContaining({ title: "Dune" })]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("saves an edited length after the details", async () => {
    const book = { ...DUNE, user: { ...DUNE.user, length: { ...emptyLength(), pages: 412 } } };
    const calls: string[] = [];
    const editManual = vi.fn(async () => (calls.push("edit"), book));
    const update = vi.fn(async (_k: string, patch: object) => {
      calls.push("update");
      return { ...book, user: { ...book.user, ...patch } };
    });
    const { library, entry, user } = setup({ editManual, update }, [book]);
    await library.hydrate();
    const saved = vi.spyOn(entry, "saved");
    entry.open({ type: "book", edit: KEY });
    await screen.findByRole("dialog", { name: "Edit Dune" });
    await user.clear(screen.getByLabelText("Pages"));
    await user.type(screen.getByLabelText("Pages"), "500");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(calls).toEqual(["edit", "update"]);
    expect(update).toHaveBeenCalledWith(KEY, { length: { ...emptyLength(), pages: 500 } });
    expect(library.get(KEY)?.user.length.pages).toBe(500);
  });

  it("does not touch the length when only the details changed", async () => {
    const book = { ...DUNE, user: { ...DUNE.user, length: { ...emptyLength(), pages: 412 } } };
    const update = vi.fn();
    const { library, entry, user } = setup({ editManual: vi.fn(async () => book), update }, [book]);
    await library.hydrate();
    entry.open({ type: "book", edit: KEY });
    await user.type(await screen.findByLabelText("Title"), " Messiah");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(update).not.toHaveBeenCalled();
  });

  it("stays open with the reason when the length save fails after the details saved", async () => {
    const book = { ...DUNE, user: { ...DUNE.user, length: { ...emptyLength(), pages: 412 } } };
    const update = vi.fn(async () => {
      throw new Error("disk full");
    });
    const { library, entry, user } = setup({ editManual: vi.fn(async () => book), update }, [book]);
    await library.hydrate();
    const saved = vi.spyOn(entry, "saved");
    entry.open({ type: "book", edit: KEY });
    await user.clear(await screen.findByLabelText("Pages"));
    await user.type(screen.getByLabelText("Pages"), "500");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/disk full/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });

  it("a changed type moves the item instead of editing it", async () => {
    const book = { ...DUNE, user: { ...DUNE.user, length: { ...emptyLength(), pages: 412 } } };
    const MANGA = "manual:manga:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";
    const manga = {
      ...book,
      key: MANGA,
      snapshot: { ...book.snapshot, media_key: MANGA, media_type: "manga" },
    } as LibraryEntry;
    const retypeManual = vi.fn(async () => manga);
    const editManual = vi.fn();
    const update = vi.fn();
    const { library, entry, user } = setup({ retypeManual, editManual, update }, [book]);
    await library.hydrate();
    const saved = vi.spyOn(entry, "saved");
    entry.open({ type: "book", edit: KEY });
    await screen.findByRole("dialog", { name: "Edit Dune" });
    await user.click(screen.getByRole("button", { name: "Manga" }));
    await user.type(screen.getByLabelText("Chapters"), "100");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saved).toHaveBeenCalledWith(manga));
    expect(retypeManual).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ media_type: "manga" }),
      { ...emptyLength(), chapters: 100 },
    );
    expect(editManual).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(library.has(KEY)).toBe(false);
  });

  it("stays open with the reason when the type change is refused", async () => {
    const retypeManual = vi.fn(async () => {
      throw "manual:manga:x is already in the library";
    });
    const { library, entry, user } = setup({ retypeManual }, [DUNE]);
    await library.hydrate();
    const saved = vi.spyOn(entry, "saved");
    entry.open({ type: "book", edit: KEY });
    await user.click(await screen.findByRole("button", { name: "Manga" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/already in the library/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });

  it("closes on Cancel without saving", async () => {
    const addManual = vi.fn();
    const { entry, user } = setup({ addManual });
    entry.open();
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(addManual).not.toHaveBeenCalled();
  });

  it("offers the item saved with after: stay in a notice", async () => {
    const { entry, user } = setup();
    entry.open({ type: "book", title: "Dune", after: "stay" });
    await user.click(await screen.findByRole("button", { name: "Save" }));
    const notice = await screen.findByRole("status", { name: "Added" });
    expect(notice).toHaveTextContent("Added Dune");
    const open = vi.spyOn(entry, "openNotice");
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(open).toHaveBeenCalledOnce();
  });
});
