import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import ContinueRow from "./ContinueRow.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";

const entry = (id: number): LibraryEntry => ({
  key: `tmdb:movie:${id}`,
  snapshot: {
    media_key: `tmdb:movie:${id}`,
    provider: "tmdb",
    media_type: "movie",
    title: `Dune ${id}`,
    poster_path: null,
    poster_file: null,
    year: "2021",
  },
  user: {
    status: "in_progress",
    progress: 0,
    rating: null,
    review: null,
    length: emptyLength(),
    plan: null,
  },
  created_at: "t",
  updated_at: "t",
});

describe("ContinueRow", () => {
  it("lists what you are in the middle of under a Continue heading", () => {
    render(ContinueRow, { entries: [entry(1), entry(2)], posterDir: null });
    const row = screen.getByRole("region", { name: "Continue" });
    expect(within(row).getAllByRole("listitem")).toHaveLength(2);
    expect(within(row).getByRole("link", { name: /Dune 1/ })).toHaveAttribute(
      "href",
      "/media/movie/1",
    );
  });

  it("renders nothing when empty", () => {
    render(ContinueRow, { entries: [], posterDir: null });
    expect(screen.queryByRole("region", { name: "Continue" })).toBeNull();
  });
});
