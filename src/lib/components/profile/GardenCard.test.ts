import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import GardenCard from "./GardenCard.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";

function entry(id: string, status: LibraryStatus): LibraryEntry {
  const key = `manual:book:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "manual",
      media_type: "book",
      title: id,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: { status, progress: 0, rating: null, review: null, length: emptyLength(), plan: null },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("GardenCard", () => {
  it("shows a few plants and links to the full garden", () => {
    render(GardenCard, { entries: [entry("A", "completed"), entry("B", "planning")] });
    expect(screen.getAllByRole("link", { name: /, book, / })).toHaveLength(2);
    const open = screen.getByRole("link", { name: /open the garden/i });
    expect(open.getAttribute("href")).toContain("/library");
  });

  it("plants only the newest handful", () => {
    const entries = Array.from({ length: 20 }, (_, i) => entry(`T${i}`, "completed"));
    render(GardenCard, { entries });
    expect(screen.getAllByRole("link", { name: /, book, / }).length).toBeLessThanOrEqual(12);
  });

  it("invites a first item when the library is empty", () => {
    render(GardenCard, { entries: [] });
    expect(screen.getByText(/nothing growing yet/i)).toBeTruthy();
  });
});
