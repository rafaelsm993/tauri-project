import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import GardenScene from "./GardenScene.svelte";
import { SCENE_CAP } from "$lib/domain/garden";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entry(
  id: string,
  status: LibraryStatus,
  opts: { type?: MediaType; title?: string; updated?: string } = {},
): LibraryEntry {
  const type = opts.type ?? "book";
  const key = `manual:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "manual",
      media_type: type,
      title: opts.title ?? id,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status,
      progress: 0,
      rating: null,
      review: null,
      length: emptyLength(),
      plan: null,
    },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: opts.updated ?? "2026-01-01T00:00:00Z",
  };
}

describe("GardenScene", () => {
  it("gives every plant a link to its item, named for a screen reader", () => {
    render(GardenScene, {
      entries: [entry("1", "completed", { title: "Piranesi" })],
    });
    const link = screen.getByRole("link", { name: "Piranesi, book, completed" });
    expect(link.getAttribute("href")).toContain("/media/book/1");
  });

  it("marks the stage of each plant so the CSS can grow it", () => {
    render(GardenScene, {
      entries: [
        entry("a", "planning", { title: "Seed" }),
        entry("b", "in_progress", { title: "Sprout" }),
        entry("c", "completed", { title: "Bloom" }),
        entry("d", "dropped", { title: "Dormant" }),
      ],
    });
    const stage = (name: string) =>
      screen.getByRole("link", { name: new RegExp(`^${name}`) }).dataset.stage;
    expect(stage("Seed")).toBe("seed");
    expect(stage("Sprout")).toBe("sprout");
    expect(stage("Bloom")).toBe("bloom");
    expect(stage("Dormant")).toBe("dormant");
  });

  it("groups the plants in a labelled list", () => {
    render(GardenScene, { entries: [entry("a", "planning")] });
    expect(screen.getByRole("list", { name: /garden/i })).toBeTruthy();
  });

  it("says how many items are past the cap and offers the grid", () => {
    const entries = Array.from({ length: 4 }, (_, i) => entry(`k${i}`, "completed"));
    render(GardenScene, { entries, cap: 2 });
    expect(screen.getAllByRole("link", { name: /k\d/ })).toHaveLength(2);
    expect(screen.getByText(/2 more/)).toBeTruthy();
  });

  it("plants at most the scene cap without being told one", () => {
    const entries = Array.from({ length: SCENE_CAP + 5 }, (_, i) => entry(`k${i}`, "completed"));
    render(GardenScene, { entries });
    expect(screen.getAllByRole("link", { name: /k\d+, / })).toHaveLength(SCENE_CAP);
    expect(screen.getByText(/5 more/)).toBeTruthy();
  });

  it("says nothing about more items when the library fits", () => {
    render(GardenScene, { entries: [entry("a", "completed")] });
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("invites a first item when the garden is empty", () => {
    render(GardenScene, { entries: [] });
    expect(screen.getByText(/nothing growing yet/i)).toBeTruthy();
    expect(screen.queryByRole("list", { name: /garden/i })).toBeNull();
  });

  it("stays still unless motion is allowed", () => {
    const { container } = render(GardenScene, {
      entries: [entry("a", "completed")],
      motion: false,
    });
    expect(container.querySelector(".garden")?.classList.contains("moves")).toBe(false);
  });

  it("sways when the reward is equipped and motion is allowed", () => {
    const { container } = render(GardenScene, {
      entries: [entry("a", "completed")],
      motion: true,
      sway: true,
    });
    expect(container.querySelector(".garden")?.classList.contains("sways")).toBe(true);
  });

  it("does not sway while the reward is not equipped", () => {
    const { container } = render(GardenScene, {
      entries: [entry("a", "completed")],
      motion: true,
      sway: false,
    });
    expect(container.querySelector(".garden")?.classList.contains("sways")).toBe(false);
  });

  it("never sways while the user has animations off, however it is equipped", () => {
    const { container } = render(GardenScene, {
      entries: [entry("a", "completed")],
      motion: false,
      sway: true,
    });
    expect(container.querySelector(".garden")?.classList.contains("sways")).toBe(false);
  });
});
