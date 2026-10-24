import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LogSessionDialog from "./LogSessionDialog.svelte";
import { emptyLength } from "$lib/domain/length";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";
import type { LibraryEntry, Plan } from "$lib/types/library";

const MON_THU: Plan = { days: [0, 1, 2, 3], max_session_minutes: 45, since: "2026-09-28" };
const FRIEREN: LibraryEntry = {
  key: "tmdb:anime:1",
  snapshot: {
    media_key: "tmdb:anime:1",
    provider: "tmdb",
    media_type: "anime",
    title: "Frieren",
    poster_path: null,
    poster_file: null,
    year: null,
  },
  user: {
    status: "in_progress",
    progress: 0,
    rating: null,
    review: null,
    length: { ...emptyLength(), episodes: 28, episode_minutes: 24 },
    plan: MON_THU,
  },
  created_at: "t",
  updated_at: "t",
};

// Thu 2026-10-01 with a 45 min session due, unless a test says otherwise.
async function setup(
  today = "2026-10-01",
  due: number | null = 45,
  saved = true,
  entry: LibraryEntry = FRIEREN,
) {
  const library = { update: vi.fn(async () => saved), isPending: () => false, error: "nope" };
  const prefs = new PrefsStore({ load: vi.fn(async () => DEFAULT_PREFS), update: vi.fn() });
  await prefs.hydrate();
  const reminders = { logged: vi.fn() };
  const onclose = vi.fn();
  render(LogSessionDialog, {
    entry,
    today,
    dueMinutes: due,
    onclose,
    library,
    prefs,
    reminders,
  });
  return { library, reminders, onclose };
}

const picker = () => screen.getByRole("group", { name: "Session length" });
const more = () => screen.getByRole("button", { name: "More episodes" });
const customBtn = () => screen.getByRole("button", { name: "Custom" });
const customInput = () => screen.getByLabelText("Minutes per session");
const logButton = () => screen.getByRole("button", { name: "Log session" });

describe("LogSessionDialog", () => {
  it("pre-fills today's session and shows what it adds and what is left", async () => {
    await setup();
    expect(screen.getByRole("dialog", { name: "Log a session of Frieren" })).toBeInTheDocument();
    // 45 planned minutes of 24-minute episodes is the nearest whole: 2 episodes.
    expect(picker()).toHaveTextContent("2 episodes");
    expect(picker()).toHaveTextContent("48 min");
    expect(screen.getByText("+2 episodes · 2 of 28 episodes")).toBeInTheDocument();
    expect(screen.getByText("14 sessions · 10 h 24 min")).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("opens without focusing the length, so the phone keyboard does not cover the sheet", async () => {
    await setup();
    expect(screen.getByRole("dialog", { name: "Log a session of Frieren" })).toHaveFocus();
    expect(screen.queryByLabelText("Minutes per session")).not.toBeInTheDocument();
  });

  it("shows the planned length, and this session and what is left in hours", async () => {
    await setup();
    expect(screen.getByText("Planned: 45 min per session")).toBeInTheDocument();
    expect(screen.getByText("0.8 h this session · 10.4 h left")).toBeInTheDocument();
    expect(screen.getByText("Tue, Oct 27")).toBeInTheDocument();
  });

  it("updates the hours, progress and finish as the length is edited", async () => {
    const { library } = await setup();
    await userEvent.click(more());
    await userEvent.click(more()); // 4 episodes, 96 min
    expect(screen.getByText("1.6 h this session · 9.6 h left")).toBeInTheDocument();
    expect(screen.getByText("+4 episodes · 4 of 28 episodes")).toBeInTheDocument();
    expect(screen.queryByText("Tue, Oct 27")).not.toBeInTheDocument();
    // The plan itself is not changed by logging a longer session.
    expect(screen.getByText("Planned: 45 min per session")).toBeInTheDocument();
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", { progress: 4 });
  });

  it("rounds to the nearest episode by itself", async () => {
    const { library } = await setup();
    await userEvent.click(customBtn());
    await userEvent.clear(customInput());
    await userEvent.type(customInput(), "30"); // 1.25
    expect(picker()).toHaveTextContent("≈ 1 episode");
    expect(screen.getByText("+1 episode · 1 of 28 episodes")).toBeInTheDocument();
    await userEvent.clear(customInput());
    await userEvent.type(customInput(), "36"); // 1.5
    expect(picker()).toHaveTextContent("≈ 2 episodes");
    expect(screen.getByText("+2 episodes · 2 of 28 episodes")).toBeInTheDocument();
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", { progress: 2 });
  });

  it("never logs less than one episode", async () => {
    await setup();
    await userEvent.click(screen.getByRole("button", { name: "Fewer episodes" }));
    expect(screen.getByRole("button", { name: "Fewer episodes" })).toBeDisabled();
    await userEvent.click(customBtn());
    await userEvent.clear(customInput());
    await userEvent.type(customInput(), "5");
    expect(picker()).toHaveTextContent("At least one episode (24 min).");
    expect(logButton()).toBeDisabled();
  });

  it("a game shorter than one hour logs +0 hours and still counts the session", async () => {
    const short: LibraryEntry = {
      ...FRIEREN,
      key: "rawg:game:1",
      snapshot: { ...FRIEREN.snapshot, media_type: "game", title: "Short" },
      user: { ...FRIEREN.user, length: { ...emptyLength(), hours: 0.25 } },
    };
    await setup("2026-10-01", 15, true, short);
    expect(picker()).toHaveTextContent("15 min");
    expect(screen.getByText("+0 hours, still counts as today's session")).toBeInTheDocument();
  });

  it("warns on a day the plan does not cover, and still logs", async () => {
    const { library } = await setup("2026-10-03", null); // Saturday
    expect(screen.getByRole("note")).toHaveTextContent("isn't one of the days you planned");
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", { progress: 2 });
  });

  it("says it is extra when today's session is already logged", async () => {
    await setup("2026-10-01", null); // Thursday, planned, but no longer due
    expect(screen.getByRole("note")).toHaveTextContent("already logged today's session");
  });

  it("saves, tells the reminders, and closes", async () => {
    const { library, reminders, onclose } = await setup();
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", { progress: 2 });
    expect(reminders.logged).toHaveBeenCalledWith("tmdb:anime:1");
    expect(onclose).toHaveBeenCalled();
  });

  it("starts a planned item", async () => {
    const planned = { ...FRIEREN, user: { ...FRIEREN.user, status: "planning" as const } };
    const { library } = await setup("2026-10-01", 45, true, planned);
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", {
      progress: 2,
      status: "in_progress",
    });
  });

  it("finishes the item on its last episode, and says so first", async () => {
    const nearly = { ...FRIEREN, user: { ...FRIEREN.user, progress: 27 } };
    const { library } = await setup("2026-10-01", 24, true, nearly);
    expect(screen.getByText("Nothing left: this finishes it.")).toBeInTheDocument();
    expect(more()).toBeDisabled();
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", {
      progress: 28,
      status: "completed",
    });
  });

  it("stays open with the reason when the save fails", async () => {
    const { onclose } = await setup("2026-10-01", 45, false);
    await userEvent.click(logButton());
    expect(screen.getByRole("alert")).toHaveTextContent("nope");
    expect(onclose).not.toHaveBeenCalled();
  });

  it("refuses an empty or zero length", async () => {
    await setup();
    await userEvent.click(customBtn());
    await userEvent.clear(customInput());
    expect(logButton()).toBeDisabled();
    await userEvent.type(customInput(), "0");
    expect(logButton()).toBeDisabled();
  });

  it("a movie logs as one full movie, nothing to pick", async () => {
    const movie: LibraryEntry = {
      ...FRIEREN,
      key: "tmdb:movie:1",
      snapshot: { ...FRIEREN.snapshot, media_type: "movie", title: "Matchbox" },
      user: { ...FRIEREN.user, length: { ...emptyLength(), runtime_minutes: 127 } },
    };
    // Planned an hour a day, but a movie is watched whole: the hours follow the movie.
    const { library } = await setup("2026-10-01", 60, true, movie);
    expect(screen.getByText("Full movie · 2 h 7 min")).toBeInTheDocument();
    expect(screen.getByText(/^2\.1 h this session/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Custom" })).not.toBeInTheDocument();
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:movie:1", {
      progress: 1,
      status: "completed",
    });
  });

  it("a book logs by the hour and shows the pages, opening on the exact due time", async () => {
    const book: LibraryEntry = {
      ...FRIEREN,
      key: "itunes:book:1",
      snapshot: { ...FRIEREN.snapshot, media_type: "book", title: "Dune" },
      user: { ...FRIEREN.user, length: { ...emptyLength(), pages: 600 } },
    };
    const { library } = await setup("2026-10-01", 45, true, book);
    expect(customInput()).toHaveValue(45);
    expect(customInput()).not.toHaveFocus();
    expect(picker()).toHaveTextContent("≈ 23 pages");
    // From Custom 45 the arrow starts at its nearest whole step (2 × 30 min), then adds one.
    await userEvent.click(screen.getByRole("button", { name: "30 min more" }));
    expect(picker()).toHaveTextContent("1 h 30 min");
    expect(picker()).toHaveTextContent("≈ 45 pages");
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("itunes:book:1", { progress: 45 });
  });
});
