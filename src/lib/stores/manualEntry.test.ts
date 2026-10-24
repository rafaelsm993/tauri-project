import { describe, expect, it, vi } from "vitest";
import { ManualEntryStore } from "./manualEntry.svelte";
import type { LibraryEntry } from "$lib/types/library";

const ENTRY = { key: "manual:book:1", snapshot: { title: "Dune" } } as LibraryEntry;

function store() {
  const navigate = vi.fn();
  const land = vi.fn();
  return { navigate, land, entry: new ManualEntryStore(navigate, land) };
}

describe("manual entry", () => {
  it("opens empty by default: a new movie, opened after saving", () => {
    const { entry } = store();
    entry.open();
    expect(entry.current).toEqual({ type: "movie", title: "", edit: null, after: "open" });
  });

  it("opens with what the button prefilled", () => {
    const { entry } = store();
    entry.open({ type: "book", title: "Dune", after: "stay" });
    expect(entry.current).toEqual({ type: "book", title: "Dune", edit: null, after: "stay" });
  });

  it("edits stay on the page by default", () => {
    const { entry } = store();
    entry.open({ type: "book", edit: "manual:book:1" });
    expect(entry.current?.after).toBe("stay");
  });

  it("close drops the sheet and does nothing else", () => {
    const { entry, navigate } = store();
    entry.open();
    entry.close();
    entry.closed();
    expect(entry.current).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens the saved item only once the sheet has really closed", () => {
    const { entry, navigate } = store();
    entry.open();
    entry.saved(ENTRY);
    expect(entry.current).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    entry.closed();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(ENTRY);
    entry.closed();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("stays put after saving with after: stay, and offers the item in a notice", () => {
    const { entry, navigate } = store();
    entry.open({ after: "stay" });
    entry.saved(ENTRY);
    entry.closed();
    expect(navigate).not.toHaveBeenCalled();
    expect(entry.notice).toEqual(ENTRY);
    entry.openNotice();
    expect(entry.notice).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(ENTRY);
  });

  it("an edit saves quietly: no notice, no navigation", () => {
    const { entry, navigate, land } = store();
    entry.open({ type: "book", edit: "manual:book:1" });
    entry.saved(ENTRY);
    entry.closed();
    expect(entry.notice).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(land).not.toHaveBeenCalled();
  });

  it("an edit that changed the type lands on the new page once closed, replacing the old", () => {
    const { entry, navigate, land } = store();
    entry.open({ type: "movie", edit: "manual:movie:1" });
    entry.saved(ENTRY);
    expect(land).not.toHaveBeenCalled();
    entry.closed();
    expect(land).toHaveBeenCalledExactlyOnceWith(ENTRY);
    expect(navigate).not.toHaveBeenCalled();
    expect(entry.notice).toBeNull();
    entry.closed();
    expect(land).toHaveBeenCalledOnce();
  });

  it("opening an existing item from the duplicate prompt also waits for the close", () => {
    const { entry, navigate } = store();
    entry.open({ after: "stay" });
    entry.openExisting(ENTRY);
    expect(entry.current).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    entry.closed();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(ENTRY);
  });

  it("opening the sheet again clears an old notice", () => {
    const { entry } = store();
    entry.open({ after: "stay" });
    entry.saved(ENTRY);
    entry.open();
    expect(entry.notice).toBeNull();
  });
});
