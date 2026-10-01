import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { clearMocks, mockConvertFileSrc } from "@tauri-apps/api/mocks";
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
      poster_file: null,
    },
    user: {
      status: "in_progress",
      progress: 3,
      rating: null,
      review: null,
      length: emptyLength(),
      plan: null,
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

  it("offers a Plan button beside the link that calls onplan", async () => {
    const onplan = vi.fn();
    render(LibraryCard, { entry: entry(), onplan });
    const button = screen.getByRole("button", { name: "Plan Arcane" });
    expect(screen.getByRole("link", { name: /arcane/i })).not.toContainElement(button);
    await fireEvent.click(button);
    expect(onplan).toHaveBeenCalled();
  });

  it("says Edit plan once the item has one", () => {
    const plan = { days: [0], max_session_minutes: 60, since: "2026-10-01" };
    render(LibraryCard, { entry: entry({ plan }), onplan: vi.fn() });
    expect(screen.getByRole("button", { name: "Edit plan for Arcane" })).toHaveTextContent(
      "Edit plan",
    );
  });

  it("has no Plan button for a dropped item or without onplan", () => {
    const { unmount } = render(LibraryCard, {
      entry: entry({ status: "dropped" }),
      onplan: vi.fn(),
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();
    render(LibraryCard, { entry: entry() });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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

describe("LibraryCard poster", () => {
  afterEach(() => clearMocks());

  it("shows the cached file, then the provider URL, then the placeholder", async () => {
    mockConvertFileSrc("linux");
    const saved = entry();
    saved.snapshot.poster_file = "tmdb_tv_7.jpg";
    const { container } = render(LibraryCard, { entry: saved, posterDir: "/data/posters" });
    const img = () => container.querySelector("img");
    expect(img()?.getAttribute("src")).toContain(encodeURIComponent("/data/posters/tmdb_tv_7.jpg"));
    await fireEvent.error(img()!);
    expect(img()?.getAttribute("src")).toBe("https://image.tmdb.org/p.jpg");
    await fireEvent.error(img()!);
    expect(img()).toBeNull();
    expect(screen.getByText("No poster")).toBeInTheDocument();
  });
});
