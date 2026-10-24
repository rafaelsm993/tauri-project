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

const minutes = () => screen.getByLabelText("Session length (minutes)");
const logButton = () => screen.getByRole("button", { name: "Log session" });

describe("LogSessionDialog", () => {
  it("pre-fills today's session and shows what it adds and what is left", async () => {
    await setup();
    expect(screen.getByRole("dialog", { name: "Log a session of Frieren" })).toBeInTheDocument();
    expect(minutes()).toHaveValue(45);
    expect(screen.getByText("+2 episodes · 2 of 28 episodes")).toBeInTheDocument();
    expect(screen.getByText("14 sessions · 10 h 24 min")).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("opens without focusing the length, so the phone keyboard does not cover the sheet", async () => {
    await setup();
    expect(screen.getByRole("dialog", { name: "Log a session of Frieren" })).toHaveFocus();
    expect(minutes()).not.toHaveFocus();
  });

  it("shows the planned length, and this session and what is left in hours", async () => {
    await setup();
    expect(screen.getByText("Planned: 45 min per session")).toBeInTheDocument();
    expect(screen.getByText("0.8 h this session · 10.4 h left")).toBeInTheDocument();
    expect(screen.getByText("Tue, Oct 27")).toBeInTheDocument();
  });

  it("updates the hours, progress and finish as the length is edited", async () => {
    const { library } = await setup();
    await userEvent.clear(minutes());
    await userEvent.type(minutes(), "96"); // 4 episodes
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
    await userEvent.clear(minutes());
    await userEvent.type(minutes(), "30"); // 1.25
    expect(screen.getByText("+1 episode · 1 of 28 episodes")).toBeInTheDocument();
    await userEvent.clear(minutes());
    await userEvent.type(minutes(), "36"); // 1.5
    expect(screen.getByText("+2 episodes · 2 of 28 episodes")).toBeInTheDocument();
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", { progress: 2 });
  });

  it("records nothing for a short session and says it still counts", async () => {
    const { library } = await setup();
    await userEvent.clear(minutes());
    await userEvent.type(minutes(), "5");
    expect(screen.getByText("+0 episodes, still counts as today's session")).toBeInTheDocument();
    await userEvent.click(logButton());
    expect(library.update).toHaveBeenCalledWith("tmdb:anime:1", { progress: 0 });
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
    await userEvent.clear(minutes());
    expect(logButton()).toBeDisabled();
    await userEvent.type(minutes(), "0");
    expect(logButton()).toBeDisabled();
  });
});
