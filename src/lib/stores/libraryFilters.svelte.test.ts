import { describe, expect, it } from "vitest";
import { LibraryFilters } from "./libraryFilters.svelte";
import { VIEW_OPTIONS } from "$lib/domain/libraryView";
describe("Library view compatibility", () => {
  it("keeps Grid as default and the legacy garden token as Tree", () => {
    const filters = new LibraryFilters();
    expect(filters.view).toBe("grid");
    expect(VIEW_OPTIONS).toEqual([
      { value: "grid", label: "Grid" },
      { value: "garden", label: "Tree" },
    ]);
    filters.query = "kept";
    filters.type = "book";
    filters.status = "completed";
    filters.view = "garden";
    expect([filters.query, filters.type, filters.status]).toEqual(["kept", "book", "completed"]);
  });
});
