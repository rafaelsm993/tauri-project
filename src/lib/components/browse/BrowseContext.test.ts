import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import BrowseContext from "./BrowseContext.svelte";

function setup(props: { isSearch?: boolean; query?: string; genreName?: string | null }) {
  render(BrowseContext, {
    isSearch: false,
    query: "",
    genreName: null,
    onClearSearch: vi.fn(),
    onAllGenres: vi.fn(),
    ...props,
  });
}

describe("BrowseContext", () => {
  it("names the selected genre in English", () => {
    setup({ genreName: "Action" });
    expect(screen.getByText(/Popular in/)).toHaveTextContent("Popular in Action");
  });

  it("names the search term", () => {
    setup({ isSearch: true, query: "dune" });
    expect(screen.getByText(/Results for/)).toHaveTextContent('Results for "dune"');
  });
});
