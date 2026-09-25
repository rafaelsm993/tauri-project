import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import LibraryCard from "./LibraryCard.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";

function entry(over: Partial<LibraryEntry["user"]> = {}): LibraryEntry {
  return {
    key: "tmdb:tv:7",
    snapshot: {
      media_key: "tmdb:tv:7",
      provider: "tmdb",
      media_type: "tv",
      title: "Arcane",
      poster_path: "https://image.tmdb.org/p.jpg",
      year: "2021",
    },
    user: {
      status: "in_progress",
      progress: 3,
      rating: null,
      review: null,
      length: emptyLength(),
      ...over,
    },
    created_at: "t",
    updated_at: "t",
  };
}

describe("LibraryCard", () => {
  it("is a link to the detail page named after the title", () => {
    render(LibraryCard, { entry: entry() });
    expect(screen.getByRole("link", { name: /arcane/i })).toHaveAttribute("href", "/media/tv/7");
  });

  it("shows status and progress without a bar when the total is unknown", () => {
    render(LibraryCard, { entry: entry() });
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("3 episodes")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a bar once the user's length gives a total", () => {
    render(LibraryCard, { entry: entry({ length: { ...emptyLength(), episodes: 9 } }) });
    expect(screen.getByText("3 of 9 episodes")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  });

  it("falls back to a text placeholder without a poster", () => {
    const e = entry();
    e.snapshot.poster_path = null;
    render(LibraryCard, { entry: e });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("No poster")).toBeInTheDocument();
  });
});
