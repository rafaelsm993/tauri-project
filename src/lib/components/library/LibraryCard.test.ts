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

const PLAN = { days: [0], max_session_minutes: 30, since: "2026-09-28" };

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

  it("puts an outline plan icon on the cover of an unplanned item, and no Log session", () => {
    render(LibraryCard, { entry: entry(), onplan: vi.fn(), onlog: vi.fn() });
    const icon = screen.getByRole("button", { name: "Plan Arcane" });
    // Sits over the cover's corner (the type badge holds the other one).
    expect(icon).toHaveClass("lib-card__plan-icon");
    expect(icon).not.toHaveClass("planned");
    expect(screen.queryByRole("button", { name: /^Log a session/ })).not.toBeInTheDocument();
  });

  it("fills the plan icon once the item has a plan", () => {
    render(LibraryCard, { entry: entry({ plan: PLAN }), onplan: vi.fn() });
    expect(screen.getByRole("button", { name: "Edit plan for Arcane" })).toHaveClass("planned");
  });

  it("offers Log session for a planned item, with today's time when due", async () => {
    const onlog = vi.fn();
    render(LibraryCard, { entry: entry({ plan: PLAN }), onplan: vi.fn(), onlog, dueMinutes: 45 });
    expect(screen.getByText("45 min today")).toBeInTheDocument();
    const log = screen.getByRole("button", { name: "Log a session of Arcane" });
    expect(log).toHaveTextContent("Log session");
    expect(screen.getByRole("link", { name: /arcane/i })).not.toContainElement(log);
    await fireEvent.click(log);
    expect(onlog).toHaveBeenCalledOnce();
  });

  it("notes no time on a day without a session", () => {
    render(LibraryCard, { entry: entry({ plan: PLAN }), onplan: vi.fn(), onlog: vi.fn() });
    expect(screen.getByRole("button", { name: "Log a session of Arcane" })).toBeInTheDocument();
    expect(screen.queryByText(/today$/)).not.toBeInTheDocument();
  });

  it("offers no Log session once the item is completed or dropped", () => {
    for (const status of ["completed", "dropped"] as const) {
      const { unmount } = render(LibraryCard, {
        entry: entry({ plan: PLAN, status }),
        onplan: vi.fn(),
        onlog: vi.fn(),
      });
      expect(screen.queryByRole("button", { name: /^Log a session/ })).not.toBeInTheDocument();
      unmount();
    }
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

  it("falls back to the drawn placeholder without a poster, keyed for the morph", () => {
    const e = entry();
    e.snapshot.poster_path = null;
    const { container } = render(LibraryCard, { entry: e });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const placeholder = container.querySelector(".placeholder");
    expect(placeholder).toHaveClass("hue-screen");
    expect(placeholder).toHaveTextContent(/^A$/);
    expect(placeholder).toHaveAttribute("data-poster");
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
    expect(container.querySelector(".placeholder")).toHaveTextContent(/^A$/);
  });
});
