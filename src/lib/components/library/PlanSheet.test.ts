import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
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
const sessionGroup = () => screen.getByRole("group", { name: "Up to, per session" });
const center = () =>
  within(sessionGroup()).getByRole("button", {
    name: /^(Full (episode|chapter)|\d+ (episodes|chapters))/,
  });
const more = () => screen.getByRole("button", { name: /^More (episodes|chapters)$/ });
const fewer = () => screen.getByRole("button", { name: /^Fewer (episodes|chapters)$/ });
const customBtn = () => within(sessionGroup()).getByRole("button", { name: "Custom" });
const customInput = () => within(sessionGroup()).getByLabelText("Minutes per session");

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
    expect(
      screen.getByText("10 sessions of about 45 min · finishes Fri, Oct 23"),
    ).toBeInTheDocument();
    await userEvent.click(more());
    expect(
      screen.getByText("5 sessions of about 1 h 30 min · finishes Mon, Oct 12"),
    ).toBeInTheDocument();
  });

  it("starts a new plan at one full episode when its length is known", async () => {
    const { onsave } = setup();
    expect(center()).toHaveAccessibleName("Full episode 45 min");
    expect(center()).toHaveAttribute("aria-pressed", "true");
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

  it("Custom puts minutes in the centre, and Custom again goes back", async () => {
    setup();
    await userEvent.click(customBtn());
    expect(customInput()).toHaveFocus();
    expect(within(sessionGroup()).queryByRole("button", { name: /^Full episode/ })).toBeNull();
    await userEvent.click(customBtn());
    expect(center()).toHaveAccessibleName("Full episode 45 min");
    expect(center()).toHaveAttribute("aria-pressed", "true");
    expect(customBtn()).toHaveAttribute("aria-pressed", "false");
  });

  it("follows the per-episode minutes typed in the sheet until a length is picked", async () => {
    setup({ entry: entry("anime", { episodes: 12 }) });
    expect(screen.queryByRole("button", { name: /^Full episode/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("Add the minutes per episode above to pick a session."),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Minutes per episode"), "24");
    expect(center()).toHaveAccessibleName("Full episode 24 min");
    expect(center()).toHaveAttribute("aria-pressed", "true");
  });

  it("opens an existing one-episode plan on Full", () => {
    const plan: Plan = { days: [0], max_session_minutes: 45, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 45 }, plan) });
    expect(center()).toHaveAccessibleName("Full episode 45 min");
    expect(center()).toHaveAttribute("aria-pressed", "true");
  });

  it("centres one full episode and steps a show by whole episodes, never below one", async () => {
    const { onsave } = setup();
    expect(center()).toHaveAccessibleName("Full episode 45 min");
    expect(fewer()).toBeDisabled();
    expect(screen.queryByRole("button", { name: "1 h" })).not.toBeInTheDocument();
    await userEvent.click(more());
    expect(center()).toHaveAccessibleName("2 episodes 1 h 30 min");
    await userEvent.click(fewer());
    expect(center()).toHaveAccessibleName("Full episode 45 min");
    await userEvent.click(more());
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].plan.max_session_minutes).toBe(90);
  });

  it("the centre button goes back to one full episode", async () => {
    setup();
    await userEvent.click(more());
    await userEvent.click(more());
    await userEvent.click(center());
    expect(center()).toHaveAccessibleName("Full episode 45 min");
  });

  it("stops at the episodes left and at 12 hours", async () => {
    setup({ entry: entry("tv", { episodes: 3, episode_minutes: 45 }, null, 1) });
    await userEvent.click(more());
    expect(more()).toBeDisabled();
    cleanup();
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 300 }) });
    await userEvent.click(more());
    expect(center()).toHaveAccessibleName("2 episodes 10 h");
    expect(more()).toBeDisabled();
  });

  it("Custom takes any minutes from one episode up, and the arrows take over again", async () => {
    const { onsave } = setup();
    await userEvent.click(customBtn());
    expect(customBtn()).toHaveAttribute("aria-pressed", "true");
    const input = customInput();
    expect(input).toHaveAttribute("min", "45");
    await userEvent.click(day(/mon/i));
    await userEvent.clear(input);
    await userEvent.type(input, "30");
    expect(screen.getByText("At least one episode (45 min).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save plan/i })).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "100");
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].plan.max_session_minutes).toBe(100);
    await userEvent.click(more());
    expect(screen.queryByLabelText("Minutes per session")).not.toBeInTheDocument();
    expect(center()).toHaveAttribute("aria-pressed", "true");
  });

  it("Custom starts from what the picker shows", async () => {
    setup();
    await userEvent.click(more());
    await userEvent.click(customBtn());
    expect(customInput()).toHaveValue(90);
  });

  it("opens an existing plan on its episodes, or on Custom when it is not whole episodes", () => {
    const two: Plan = { days: [0], max_session_minutes: 90, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 45 }, two) });
    expect(center()).toHaveAccessibleName("2 episodes 1 h 30 min");
    cleanup();
    const odd: Plan = { days: [0], max_session_minutes: 60, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 45 }, odd) });
    expect(customBtn()).toHaveAttribute("aria-pressed", "true");
    expect(customInput()).toHaveValue(60);
    cleanup();
    const short: Plan = { days: [0], max_session_minutes: 15, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 10, episode_minutes: 45 }, short) });
    expect(center()).toHaveAccessibleName("Full episode 45 min");
    expect(center()).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Minutes per session")).not.toBeInTheDocument();
  });

  describe("with a length from the catalog", () => {
    const NEW_TV = entry("tv", { episodes: 48 }, null, 0);
    const FOUND = { ...emptyLength(), episodes: 48, episode_minutes: 24 };

    it("fills what the catalog knows, says so, and starts on one full episode", async () => {
      const { onsave } = setup({ entry: NEW_TV, found: FOUND });
      expect(screen.getByLabelText("Minutes per episode")).toHaveValue(24);
      expect(screen.getByText(/filled in from tmdb/i)).toBeInTheDocument();
      expect(center()).toHaveAccessibleName("Full episode 24 min");
      expect(center()).toHaveAttribute("aria-pressed", "true");
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

  it("waits for a book's pages or a game's hours before offering a session", async () => {
    setup({ entry: entry("book", {}) });
    expect(screen.getByText("Add the pages above to pick a session.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1 h" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Custom" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Pages"), "300");
    expect(sessionGroup()).toHaveTextContent("≈ 30 pages");
    cleanup();
    setup({ entry: entry("game", {}) });
    expect(
      screen.getByText("Add the hours to finish above to pick a session."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Custom" })).not.toBeInTheDocument();
    cleanup();
    setup({ entry: entry("manga", { chapters: 100 }) });
    expect(
      screen.getByText("Add the minutes per chapter above to pick a session."),
    ).toBeInTheDocument();
    cleanup();
    // A movie keeps its chips even before its runtime is known.
    setup({ entry: entry("movie", {}) });
    expect(screen.queryByText(/above to pick a session/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("steps a book or a game by 30 minutes, without a Full", () => {
    setup({ entry: entry("game", { hours: 20 }) });
    expect(sessionGroup()).toHaveTextContent("1 h");
    expect(screen.queryByRole("button", { name: /^Full / })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 min more" })).toBeInTheDocument();
  });

  it("steps a manga of 3-minute chapters by chapters", () => {
    setup({ entry: entry("manga", { chapters: 100, chapter_minutes: 3 }) });
    expect(center()).toHaveAccessibleName("Full chapter 3 min");
  });

  it("shows the pages a book's session is worth at the pace being typed", async () => {
    setup({ entry: entry("book", { pages: 300 }), pagesPerHour: 30 });
    expect(sessionGroup()).toHaveTextContent("≈ 30 pages");
    const pace = screen.getByLabelText(/pages per hour/i);
    await userEvent.clear(pace);
    await userEvent.type(pace, "60");
    expect(sessionGroup()).toHaveTextContent("≈ 60 pages");
  });

  it("saves the chosen days, session length and today as the start", async () => {
    const { onsave } = setup();
    await userEvent.click(day(/sat/i));
    await userEvent.click(day(/tue/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave).toHaveBeenCalledWith({
      plan: { days: [1, 5], max_session_minutes: 45, since: TODAY },
      length: null,
      pagesPerHour: null,
    });
  });

  it("takes a custom session length between 30 and 720 minutes", async () => {
    const { onsave } = setup({ entry: entry("game", { hours: 20 }) });
    await userEvent.click(day(/mon/i));
    await userEvent.click(customBtn());
    const input = customInput();
    await userEvent.clear(input);
    await userEvent.type(input, "20");
    expect(screen.getByText("At least 30 min.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save plan/i })).toBeDisabled();
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
    expect(minutes).toHaveAttribute("aria-required", "true");
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
    expect(screen.getByText(/^10 sessions/)).toBeInTheDocument();
    const pace = screen.getByLabelText(/pages per hour/i);
    await userEvent.clear(pace);
    await userEvent.type(pace, "60");
    expect(screen.getByText(/^5 sessions/)).toBeInTheDocument();
  });

  it("prefills a manga's missing minutes per chapter from the Settings default", async () => {
    const { onsave } = setup({ entry: entry("manga", { chapters: 100 }), chapterMinutes: 6 });
    expect(screen.getByLabelText("Minutes per chapter")).toHaveValue(6);
    expect(center()).toHaveAccessibleName("Full chapter 6 min");
    expect(center()).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(day(/mon/i));
    await userEvent.click(screen.getByRole("button", { name: /^save plan/i }));
    expect(onsave.mock.calls[0][0].length?.chapter_minutes).toBe(6);
  });

  it("keeps a manga's own minutes per chapter over the Settings default", () => {
    setup({ entry: entry("manga", { chapters: 100, chapter_minutes: 9 }), chapterMinutes: 6 });
    expect(screen.queryByLabelText("Minutes per chapter")).not.toBeInTheDocument();
    expect(center()).toHaveAccessibleName("Full chapter 9 min");
  });

  it("editing a plan says how the finish line moves, never that you are behind", async () => {
    const plan: Plan = { days: [0, 2, 4], max_session_minutes: 120, since: "2026-09-28" };
    setup({ entry: entry("tv", { episodes: 8, episode_minutes: 60 }, plan) });
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
