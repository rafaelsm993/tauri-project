import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SearchBar from "./SearchBar.svelte";

function setup(props: { loading?: boolean } = {}) {
  const onSearch = vi.fn();
  const onclear = vi.fn();
  const view = render(SearchBar, { onSearch, onclear, ...props });
  const input = screen.getByRole("searchbox", { name: "Search the catalog" });
  return { onSearch, onclear, input, view };
}

describe("SearchBar", () => {
  it("is a labelled search landmark", () => {
    setup();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("submits the trimmed text and never shows a spinner on its own", async () => {
    const { input, onSearch } = setup();
    await userEvent.type(input, "  dune {Enter}");
    expect(onSearch).toHaveBeenCalledWith("dune");
    expect(screen.queryByRole("status", { name: "Searching" })).toBeNull();
  });

  it("shows the spinner only while the search is loading", async () => {
    const { view } = setup({ loading: true });
    expect(screen.getByRole("status", { name: "Searching" })).toBeInTheDocument();
    await view.rerender({ loading: false });
    expect(screen.queryByRole("status", { name: "Searching" })).toBeNull();
  });

  it("the clear button empties the field and clears the results", async () => {
    const { input, onclear } = setup();
    await userEvent.type(input, "dune");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(onclear).toHaveBeenCalledOnce();
    expect(input).toHaveFocus();
  });
});
