import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import TodayStrip from "./TodayStrip.svelte";
import type { DueSession, TodayPlan } from "$lib/domain/reminders";
import type { LibraryEntry } from "$lib/types/library";

const due = (id: number, title: string, minutes: number): DueSession => ({
  entry: {
    key: `tmdb:tv:${id}`,
    snapshot: {
      media_key: `tmdb:tv:${id}`,
      provider: "tmdb",
      media_type: "tv",
      title,
      poster_path: null,
      poster_file: null,
      year: null,
    },
  } as LibraryEntry,
  family: "screen",
  minutes,
  finish: "2026-10-12",
});

function setup(today: TodayPlan, busy: (key: string) => boolean = () => false) {
  const handlers = { ondone: vi.fn(), onnext: vi.fn() };
  render(TodayStrip, { today, busy, ...handlers });
  return handlers;
}

describe("TodayStrip", () => {
  it("lists each session with its minutes", () => {
    setup({ due: [due(1, "Dune", 90), due(2, "Arcane", 30)], replanned: null });
    const strip = screen.getByRole("region", { name: "Today" });
    const items = within(strip).getAllByRole("listitem");
    expect(items.map((li) => li.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringContaining("Dune 1 h 30 min"),
      expect.stringContaining("Arcane 30 min"),
    ]);
  });

  it("marks a session done, moves it to the next session or opens it", async () => {
    const h = setup({ due: [due(1, "Dune", 90)], replanned: null });
    await fireEvent.click(screen.getByRole("button", { name: "Done: Dune" }));
    await fireEvent.click(screen.getByRole("button", { name: "Next session: Dune" }));
    expect(h.ondone).toHaveBeenCalledWith("tmdb:tv:1");
    expect(h.onnext).toHaveBeenCalledWith("tmdb:tv:1");
    expect(screen.getByRole("link", { name: /Dune/ })).toHaveAttribute("href", "/media/tv/1");
  });

  it("disables an item's buttons while it saves", () => {
    setup(
      { due: [due(1, "Dune", 90), due(2, "Arcane", 30)], replanned: null },
      (k) => k === "tmdb:tv:1",
    );
    expect(screen.getByRole("button", { name: "Done: Dune" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next session: Dune" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Done: Arcane" })).toBeEnabled();
  });

  it("notes earlier sessions as re-planned", () => {
    setup({ due: [], replanned: { count: 2, title: "Frieren", finish: "2026-10-28" } });
    expect(screen.getByRole("region", { name: "Today" })).toHaveTextContent(
      "2 earlier sessions re-planned · Frieren now finishes Wed, Oct 28",
    );
    expect(screen.getByText("Nothing else planned for today.")).toBeInTheDocument();
  });

  it("renders nothing when there is nothing to say", () => {
    setup({ due: [], replanned: null });
    expect(screen.queryByRole("region", { name: "Today" })).not.toBeInTheDocument();
  });
});
