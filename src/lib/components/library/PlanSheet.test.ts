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
    chapterMinutes: null,
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

  it("starts a new plan at one full episode when its length is known", async () => {
    const { onsave } = setup();
    expect(screen.getByRole("button", { name: "Full episode · 45 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "1 h" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].plan.max_session_minutes).toBe(45);
  });

  it("offers a full movie, and a preset still wins once picked", async () => {
    const { onsave } = setup({ entry: entry("movie", { runtime_minutes: 130 }) });
    const full = screen.getByRole("button", { name: "Full movie · 2 h 10 min" });
    expect(full).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "1 h" }));
    expect(full).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(day(/sat/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].plan.max_session_minutes).toBe(60);
  });

  it("Custom turns Full off, and Full can be picked again", async () => {
    setup();
    const full = screen.getByRole("button", { name: "Full episode · 45 min" });
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(full).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(full);
    expect(full).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "false");
  });

  it("follows the per-episode minutes typed in the sheet until a length is picked", async () => {
    setup({ entry: entry("anime", { episodes: 12 }) });
    expect(screen.queryByRole("button", { name: /^Full episode/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 h" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(screen.getByLabelText("Minutes per episode"), "24");
    expect(screen.getByRole("button", { name: "Full episode · 24 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens an existing one-episode plan on Full", () => {
    const plan: Plan = { days: [0], max_session_minutes: 45, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 45 }, plan) });
    expect(screen.getByRole("button", { name: "Full episode · 45 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("an existing plan of another length keeps it", () => {
    const plan: Plan = { days: [0], max_session_minutes: 90, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 45 }, plan) });
    expect(screen.getByRole("button", { name: "Full episode · 45 min" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "1 h 30 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  describe("with a length from the catalog", () => {
    const NEW_TV = entry("tv", { episodes: 48 }, null, 0);
    const FOUND = { ...emptyLength(), episodes: 48, episode_minutes: 24 };

    it("fills what the catalog knows, says so, and starts on one full episode", async () => {
      const { onsave } = setup({ entry: NEW_TV, found: FOUND });
      expect(screen.getByLabelText("Minutes per episode")).toHaveValue(24);
      expect(screen.getByText(/filled in from tmdb/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Full episode · 24 min" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await userEvent.click(day(/tue/i));
      await userEvent.click(screen.getByRole("button", { name: "Save plan" }));
      expect(onsave.mock.calls[0][0].length).toMatchObject({ episodes: 48, episode_minutes: 24 });
      expect(onsave.mock.calls[0][0].plan.max_session_minutes).toBe(24);
    });

    it("keeps the user's own number over the catalog's", async () => {
      const { onsave } = setup({ entry: entry("tv", { episodes: 10 }, null, 0), found: FOUND });
      expect(screen.queryByLabelText("Episodes")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Minutes per episode")).toHaveValue(24);
      await userEvent.click(day(/tue/i));
      await userEvent.click(screen.getByRole("button", { name: "Save plan" }));
      expect(onsave.mock.calls[0][0].length).toMatchObject({ episodes: 10, episode_minutes: 24 });
    });

    it("warns, in the accent note, about what the catalog could not give", () => {
      setup({ entry: entry("tv", {}, null, 0), found: { ...emptyLength(), episodes: 42 } });
      const note = screen.getByRole("note");
      expect(note).toHaveTextContent(
        "TMDB doesn't list the minutes per episode for Arcane. Add it yourself: your plan is only as accurate as this number.",
      );
      expect(within(note).queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Minutes per episode")).toHaveValue(null);
    });

    it("shows no warning when the catalog was not asked", () => {
      setup({ entry: entry("tv", { episodes: 42 }, null, 0), found: null });
      expect(screen.queryByRole("note")).not.toBeInTheDocument();
      expect(screen.getByText(/needed to plan it/i)).toBeInTheDocument();
    });

    it("says nothing about the catalog when it filled nothing", () => {
      setup({ entry: NEW_TV, found: emptyLength() });
      expect(screen.getByLabelText("Minutes per episode")).toHaveValue(null);
      expect(screen.queryByText(/filled in from/i)).not.toBeInTheDocument();
    });
  });

  it("offers no Full for a book or a game", () => {
    setup({ entry: entry("game", { hours: 20 }) });
    expect(screen.queryByRole("button", { name: /^Full / })).not.toBeInTheDocument();
  });

  it("offers no Full when one chapter is shorter than the shortest session", () => {
    setup({ entry: entry("manga", { chapters: 100, chapter_minutes: 3 }) });
    expect(screen.queryByRole("button", { name: /^Full / })).not.toBeInTheDocument();
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

  it("always shows the book pace, prefilled, and sends it only when changed", async () => {
    const { onsave } = setup({ entry: entry("book", { pages: 300 }), pagesPerHour: 45 });
    const pace = screen.getByLabelText(/pages per hour/i);
    expect(pace).toHaveValue(45);
    expect(screen.getByText("Kept for every book. Also in Settings.")).toBeInTheDocument();
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].pagesPerHour).toBeNull();
    await userEvent.clear(pace);
    await userEvent.type(pace, "60");
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[1][0].pagesPerHour).toBe(60);
  });

  it("previews with the pace being typed", async () => {
    setup({ entry: entry("book", { pages: 300 }), pagesPerHour: 30 });
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: "1 h" }));
    expect(screen.getByText(/^10 sessions/)).toBeInTheDocument();
    const pace = screen.getByLabelText(/pages per hour/i);
    await userEvent.clear(pace);
    await userEvent.type(pace, "60");
    expect(screen.getByText(/^5 sessions/)).toBeInTheDocument();
  });

  it("prefills a manga's missing minutes per chapter from the Settings default", async () => {
    const { onsave } = setup({ entry: entry("manga", { chapters: 100 }), chapterMinutes: 6 });
    expect(screen.getByLabelText("Minutes per chapter")).toHaveValue(6);
    expect(screen.getByRole("button", { name: "Full chapter · 6 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].length?.chapter_minutes).toBe(6);
  });

  it("keeps a manga's own minutes per chapter over the Settings default", () => {
    setup({ entry: entry("manga", { chapters: 100, chapter_minutes: 9 }), chapterMinutes: 6 });
    expect(screen.queryByLabelText("Minutes per chapter")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full chapter · 9 min" })).toBeInTheDocument();
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
