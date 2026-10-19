import { describe, expect, it, vi } from "vitest";
import { MatchStore } from "./match.svelte";
import type { LibraryEntry } from "$lib/types/library";

const MANUAL = { key: "manual:book:m1", snapshot: { title: "Piranesi" } } as LibraryEntry;
const MERGED = { key: "itunes:book:42", snapshot: { title: "Piranesi" } } as LibraryEntry;

function setup(unmerge: () => Promise<LibraryEntry | null> = async () => MANUAL) {
  const navigate = vi.fn();
  const library = { unmerge: vi.fn(unmerge), error: "" };
  return { navigate, library, match: new MatchStore(navigate) };
}

describe("finding a match", () => {
  it("opens for one manual entry and closes without going anywhere", () => {
    const { match, navigate } = setup();
    match.open(MANUAL);
    expect(match.current).toEqual(MANUAL);
    match.close();
    match.closed();
    expect(match.current).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("lands on the catalog item only once the sheet has really closed, then offers Undo", () => {
    const { match, navigate } = setup();
    match.open(MANUAL);
    match.merged(MERGED);
    expect(match.current).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    match.closed();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(MERGED);
    expect(match.notice).toEqual({ manual: MANUAL, into: MERGED });
    match.closed();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("undo puts the manual item back and returns to its page", async () => {
    const { match, navigate, library } = setup();
    match.open(MANUAL);
    match.merged(MERGED);
    match.closed();
    await match.undo(library);
    expect(library.unmerge).toHaveBeenCalledWith(MANUAL.key);
    expect(navigate).toHaveBeenLastCalledWith(MANUAL);
    expect(match.notice).toBeNull();
    expect(match.error).toBe("");
  });

  it("a refused undo stays on the catalog item and says why", async () => {
    const { match, navigate, library } = setup(async () => {
      library.error = "it changed after the match, so the match can't be undone";
      return null;
    });
    match.open(MANUAL);
    match.merged(MERGED);
    match.closed();
    await match.undo(library);
    expect(navigate).toHaveBeenCalledOnce();
    expect(match.notice).toBeNull();
    expect(match.error).toMatch(/changed after the match/);
    match.dismiss();
    expect(match.error).toBe("");
  });

  it("opening a new search drops an old Undo offer", () => {
    const { match } = setup();
    match.open(MANUAL);
    match.merged(MERGED);
    match.closed();
    match.open(MANUAL);
    expect(match.notice).toBeNull();
  });
});
