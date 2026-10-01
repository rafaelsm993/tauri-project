import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import ReminderToast from "./ReminderToast.svelte";
import type { DueSession } from "$lib/domain/reminders";
import type { LibraryEntry } from "$lib/types/library";

const session: DueSession = {
  entry: {
    key: "anilist:anime:1",
    snapshot: {
      media_key: "anilist:anime:1",
      provider: "anilist",
      media_type: "anime",
      title: "Frieren",
      poster_path: null,
      poster_file: null,
      year: null,
    },
  } as LibraryEntry,
  family: "anime",
  minutes: 45,
  finish: "2026-10-12",
};

function setup(s: DueSession | null = session) {
  const handlers = { onstart: vi.fn(), onlater: vi.fn(), onclose: vi.fn() };
  render(ReminderToast, { session: s, motion: false, ...handlers });
  return handlers;
}

describe("ReminderToast", () => {
  it("says what is planned for today, politely", () => {
    setup();
    const region = screen.getByRole("status", { name: "Reminder" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("45 min of Frieren planned for today");
    expect(region.textContent).not.toMatch(/behind|late\b|overdue|missed|fail/i);
  });

  it("starts, waits or closes from its buttons", async () => {
    const h = setup();
    await fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await fireEvent.click(screen.getByRole("button", { name: "Later" }));
    await fireEvent.click(screen.getByRole("button", { name: "Close reminder" }));
    expect(h.onstart).toHaveBeenCalledWith(session);
    expect(h.onlater).toHaveBeenCalledOnce();
    expect(h.onclose).toHaveBeenCalledOnce();
  });

  it("stays until it is handled", () => {
    vi.useFakeTimers();
    const h = setup();
    vi.advanceTimersByTime(10 * 60_000);
    expect(h.onclose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("keeps an empty live region with nothing to say", () => {
    setup(null);
    expect(screen.getByRole("status", { name: "Reminder" })).toBeEmptyDOMElement();
  });
});
