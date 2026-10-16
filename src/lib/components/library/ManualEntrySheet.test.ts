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
