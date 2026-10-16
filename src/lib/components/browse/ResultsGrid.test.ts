import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ResultsGrid from "./ResultsGrid.svelte";
import { manualEntry } from "$lib/stores/manualEntry.svelte";

const empty = { items: [], loading: false, appending: false, hasMore: false, hasError: false };
const handlers = { onCardClick: vi.fn(), onLoadMore: vi.fn() };

describe("ResultsGrid empty search", () => {
  it("offers adding what you searched for, prefilled with the query and the tab", async () => {
    const open = vi.spyOn(manualEntry, "open").mockImplementation(() => {});
    render(ResultsGrid, { ...empty, ...handlers, query: "  Mystery zine ", type: "book" });
    await userEvent.click(screen.getByRole("button", { name: "Add it yourself" }));
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ type: "book", title: "Mystery zine" }),
    );
    open.mockRestore();
  });

  it("offers nothing when no search was typed, or the search failed", () => {
    render(ResultsGrid, { ...empty, ...handlers });
    expect(screen.queryByRole("button", { name: "Add it yourself" })).toBeNull();
    render(ResultsGrid, { ...empty, ...handlers, hasError: true, query: "x" });
    expect(screen.queryByRole("button", { name: "Add it yourself" })).toBeNull();
  });
});
