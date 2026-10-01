import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import PlanSheet from "./PlanSheet.svelte";
import { emptyLength } from "$lib/domain/length";
import type { Length, LibraryEntry, LibraryStatus, Plan } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entry(
  type: MediaType,
  length: Partial<Length>,
  plan: Plan | null = null,
  progress = 0,
  status: LibraryStatus = "in_progress",
): LibraryEntry {
  return {
    key: `tmdb:${type}:1`,
    snapshot: {
      media_key: `tmdb:${type}:1`,
      provider: "tmdb",
      media_type: type,
      title: "Arcane",
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status,
      progress,
      rating: null,
      review: null,
      length: { ...emptyLength(), ...length },
      plan,
    },
    created_at: "",
    updated_at: "",
  };
}

const TV = entry("tv", { episodes: 10, episode_minutes: 45 }, null, 0);
const TODAY = "2026-10-01";

function setup(over: Record<string, unknown> = {}) {
  const props = {
    entry: TV,
    today: TODAY,
    pagesPerHour: null,
    onsave: vi.fn(),
    onclear: vi.fn(),
    oncancel: vi.fn(),
    ...over,
  };
  render(PlanSheet, props);
  return props;
}

const day = (name: RegExp) =>
  within(screen.getByRole("group", { name: /days/i })).getByRole("button", { name });

describe("PlanSheet", () => {
  it("offers the seven days as toggles and cannot save without one", async () => {
    setup();
    const days = within(screen.getByRole("group", { name: /days/i })).getAllByRole("button");
    expect(days.map((d) => d.textContent?.trim())).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(days.every((d) => d.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByRole("button", { name: /^save plan/i })).toBeDisabled();
    await userEvent.click(day(/mon/i));
    expect(day(/mon/i)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^save plan/i })).toBeEnabled();
  });

  it("previews the sessions and the finish date as the conditions change", async () => {
    setup();
    await userEvent.click(day(/mon/i));
    await userEvent.click(day(/wed/i));
    await userEvent.click(day(/fri/i));
    await userEvent.click(screen.getByRole("button", { name: "1 h" }));
    expect(
      screen.getByText("8 sessions of about 56 min · finishes Mon, Oct 19"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "2 h" }));
    expect(
      screen.getByText("4 sessions of about 1 h 53 min · finishes Fri, Oct 9"),
    ).toBeInTheDocument();
  });

  it("saves the chosen days, session length and today as the start", async () => {
    const { onsave } = setup();
    await userEvent.click(day(/sat/i));
    await userEvent.click(day(/tue/i));
    await userEvent.click(screen.getByRole("button", { name: "45 min" }));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave).toHaveBeenCalledWith({
      plan: { days: [1, 5], max_session_minutes: 45, since: TODAY },
      length: null,
      pagesPerHour: null,
    });
  });

  it("takes a custom session length between 5 and 720 minutes", async () => {
    const { onsave } = setup();
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: /custom/i }));
    const input = screen.getByLabelText(/minutes per session/i);
    await userEvent.clear(input);
    await userEvent.type(input, "800");
    expect(screen.getByRole("button", { name: /^save plan/i })).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "50");
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].plan.max_session_minutes).toBe(50);
  });

  it("asks only for the missing length, says why, and saves it with the plan", async () => {
    const { onsave } = setup({ entry: entry("tv", { episodes: 10 }) });
    expect(screen.getByText(/needed to plan it/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^episodes/i)).not.toBeInTheDocument();
    const minutes = screen.getByLabelText(/minutes per episode/i);
    await userEvent.click(day(/mon/i));
    expect(screen.getByRole("button", { name: /^save plan/i })).toBeDisabled();
    await userEvent.type(minutes, "30");
    expect(screen.getByText(/finishes/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].length).toMatchObject({ episodes: 10, episode_minutes: 30 });
  });

  it("asks a book's reading pace once, prefilled, and saves it", async () => {
    const book = entry("book", { pages: 300 });
    const { onsave } = setup({ entry: book });
    const pace = screen.getByLabelText(/pages per hour/i);
    expect(pace).toHaveValue(30);
    await userEvent.clear(pace);
    await userEvent.type(pace, "60");
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].pagesPerHour).toBe(60);
  });

  it("does not ask the pace again once it is saved", () => {
    setup({ entry: entry("book", { pages: 300 }), pagesPerHour: 45 });
    expect(screen.queryByLabelText(/pages per hour/i)).not.toBeInTheDocument();
    expect(screen.getByText(/at 45 pages an hour/i)).toBeInTheDocument();
  });

  it("editing a plan says how the finish line moves, never that you are behind", async () => {
    const plan: Plan = { days: [0, 2, 4], max_session_minutes: 120, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 45 }, plan) });
    expect(day(/wed/i)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/same finish date/i)).toBeInTheDocument();
    await userEvent.click(day(/fri/i));
    expect(screen.getByText(/finishes 5 days later than before/i)).toBeInTheDocument();
    await userEvent.click(day(/sat/i));
    await userEvent.click(day(/sun/i));
    expect(screen.getByText("Finishes 2 days earlier than before.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/behind|late |overdue|missed/i);
  });

  it("stops planning an item that has a plan", async () => {
    const plan: Plan = { days: [0], max_session_minutes: 60, since: "2026-09-28" };
    const { onclear } = setup({ entry: entry("tv", { episodes: 2, episode_minutes: 30 }, plan) });
    await userEvent.click(screen.getByRole("button", { name: /stop planning/i }));
    expect(onclear).toHaveBeenCalled();
  });

  it("has no stop button for an item without a plan", () => {
    setup();
    expect(screen.queryByRole("button", { name: /stop planning/i })).not.toBeInTheDocument();
  });
});
