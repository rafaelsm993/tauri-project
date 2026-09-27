import { afterEach, describe, expect, it, vi } from "vitest";

// jsdom has neither; LayerChart reads both when it loads.
vi.hoisted(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

import { tick } from "svelte";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import ProfileView from "./ProfileView.svelte";
import { GamificationStore } from "$lib/stores/gamification.svelte";
import { prefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";
import type { Length, LibraryEntry, LibraryEvent, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

const ev = (id: string, local_date: string): LibraryEvent => ({
  id,
  kind: "library_add",
  media_key: `tmdb:movie:${id}`,
  at_utc: "",
  local_date,
  payload: { status: "completed", rating: 9 },
});

const len = (over: Partial<Length> = {}): Length => ({
  runtime_minutes: null,
  episodes: null,
  episode_minutes: null,
  chapters: null,
  chapter_minutes: null,
  pages: null,
  hours: null,
  ...over,
});

function entry(
  id: string,
  type: MediaType,
  status: LibraryStatus,
  length: Partial<Length> = {},
  progress = 0,
): LibraryEntry {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: id,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: { status, progress, rating: null, review: null, length: len(length) },
    created_at: "",
    updated_at: "",
  };
}

// Both movies stay under 2 h, so their completions earn no length bonus.
const LIBRARY = [
  entry("1", "movie", "completed", { runtime_minutes: 119 }, 1),
  entry("2", "movie", "completed", { runtime_minutes: 100 }, 1),
  entry("3", "game", "in_progress", { hours: 40 }, 10),
  entry("4", "anime", "planning"),
];

function storeWith(events: LibraryEvent[] | Error, entries: LibraryEntry[] = LIBRARY) {
  const client = {
    events: vi.fn(async () => {
      if (events instanceof Error) throw events;
      return events;
    }),
  };
  return new GamificationStore(
    client,
    () => entries,
    () => "2026-09-20",
  );
}

const LOG = [ev("1", "2026-09-19"), ev("2", "2026-09-20")];

afterEach(() => {
  prefsStore.prefs = { ...DEFAULT_PREFS };
  prefsStore.ready = false;
});

// A store that just crossed a level live, so its ring owes a burst.
async function burstingStore() {
  const store = storeWith(LOG);
  await store.load();
  store.burst = true;
  return store;
}

describe("ProfileView", () => {
  it("shows the level, title and XP in the level card", async () => {
    render(ProfileView, { store: storeWith(LOG) });
    const card = await screen.findByRole("region", { name: "Level" });
    expect(within(card).getByRole("img", { name: /Level 1, 130 of 141 XP/ })).toBeInTheDocument();
    expect(within(card).getByText("Newcomer")).toBeInTheDocument();
    expect(within(card).getByText(/11 XP to level 2/)).toBeInTheDocument();
    expect(within(card).getByText(/Next title: Curious Mind at level 3/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument();
  });

  it("shows the stat tiles", async () => {
    render(ProfileView, { store: storeWith(LOG) });
    const tiles = await screen.findByRole("region", { name: "Stats" });
    const tile = (name: string) => within(tiles).getByRole("group", { name });
    expect(within(tile("Completed")).getByText("2")).toBeInTheDocument();
    expect(within(tile("Streak")).getByText("2 days")).toBeInTheDocument();
    expect(within(tile("Streak")).getByText("Longest 2")).toBeInTheDocument();
    expect(within(tile("Hours logged")).getByText("14")).toBeInTheDocument();
    expect(within(tile("In progress")).getByText("1")).toBeInTheDocument();
  });

  it("switches the progression range", async () => {
    render(ProfileView, { store: storeWith(LOG) });
    const card = await screen.findByRole("region", { name: "Progression" });
    const range = within(card).getByRole("group", { name: "Range" });
    const all = within(range).getByRole("button", { name: "All" });
    await fireEvent.click(all);
    expect(all).toHaveAttribute("aria-pressed", "true");
    const table = within(card).getByRole("table", { name: "Total XP at the end of each week" });
    expect(table).toHaveTextContent("130");
  });

  it("describes the streak heatmap, with each active day readable without hover", async () => {
    render(ProfileView, { store: storeWith(LOG) });
    const card = await screen.findByRole("region", { name: "Activity" });
    expect(
      within(card).getByRole("img", { name: /2 active days in the last 16 weeks/ }),
    ).toBeInTheDocument();
    expect(within(card).getByText(/longest 2 days/)).toBeInTheDocument();
    const days = within(card).getByRole("table", { name: "Active days" });
    expect(days).toHaveTextContent("2026-09-191 action");
    expect(days).toHaveTextContent("2026-09-201 action");
  });

  it("describes the library by status and by family", async () => {
    render(ProfileView, { store: storeWith(LOG) });
    const library = await screen.findByRole("region", { name: "Library" });
    expect(
      within(library).getByRole("img", { name: /4 items: 1 planning, 1 in progress, 2 completed/ }),
    ).toBeInTheDocument();
    const families = screen.getByRole("region", { name: "Taste" });
    expect(within(families).getByRole("table")).toHaveTextContent("Movies & TV2");
  });

  it("forecasts the backlog and the next level", async () => {
    render(ProfileView, { store: storeWith(LOG) });
    const card = await screen.findByRole("region", { name: "Forecast" });
    expect(within(card).getByText("30")).toHaveTextContent("30hours");
    expect(within(card).getByText(/left on 1 item/)).toBeInTheDocument();
    expect(within(card).getByText(/1 item has no length yet/)).toBeInTheDocument();
    expect(within(card).getByText(/Level 2 in about 3 days/)).toBeInTheDocument();
    const table = within(card).getByRole("table", { name: "XP per week, then at this pace" });
    expect(table).toHaveTextContent("Projected");
  });

  it("does not promise a date more than a year away", async () => {
    const old = [{ ...ev("1", "2026-08-25"), payload: null }];
    render(ProfileView, { store: storeWith(old) });
    const card = await screen.findByRole("region", { name: "Forecast" });
    expect(within(card).getByText(/Level 2 in more than a year/)).toBeInTheDocument();
  });

  it("keeps the level and history when every item was removed", async () => {
    render(ProfileView, { store: storeWith(LOG, []) });
    expect(await screen.findByRole("region", { name: "Progression" })).toBeInTheDocument();
    const library = screen.getByRole("region", { name: "Library" });
    expect(within(library).getByText(/Your library is empty/)).toBeInTheDocument();
    expect(within(library).queryByRole("img")).not.toBeInTheDocument();
  });

  it("bursts the ring once after a level-up, then settles", async () => {
    const store = await burstingStore();
    render(ProfileView, { store, motion: true });
    const ring = await screen.findByRole("img", { name: /^Level 1,/ });
    expect(ring).toHaveAttribute("data-burst");
    await fireEvent.animationEnd(ring);
    expect(store.burst).toBe(false);
    expect(ring).not.toHaveAttribute("data-burst");
  });

  it("skips the burst when motion is off", async () => {
    const store = await burstingStore();
    render(ProfileView, { store, motion: false });
    const ring = await screen.findByRole("img", { name: /^Level 1,/ });
    expect(ring).not.toHaveAttribute("data-burst");
  });

  it("follows the animation setting once the saved settings arrive", async () => {
    const store = await burstingStore();
    prefsStore.prefs = { ...DEFAULT_PREFS, background_animation: false };
    prefsStore.ready = true;
    render(ProfileView, { store });
    const ring = await screen.findByRole("img", { name: /^Level 1,/ });
    expect(ring).not.toHaveAttribute("data-burst");
    prefsStore.prefs = { ...DEFAULT_PREFS, background_animation: true };
    await tick();
    expect(ring).toHaveAttribute("data-burst");
  });

  it("holds the burst until the saved settings say motion is allowed", async () => {
    const store = await burstingStore();
    prefsStore.ready = false;
    render(ProfileView, { store });
    const ring = await screen.findByRole("img", { name: /^Level 1,/ });
    expect(ring).not.toHaveAttribute("data-burst");
  });

  it("moves to a new day when the window comes back", async () => {
    let day = "2026-09-20";
    const store = new GamificationStore(
      { events: async () => LOG },
      () => LIBRARY,
      () => day,
    );
    render(ProfileView, { store });
    await screen.findByRole("region", { name: "Stats" });
    day = "2026-09-23";
    await fireEvent.focus(window);
    expect(store.today).toBe("2026-09-23");
  });

  it("invites a new user to start instead of empty charts", async () => {
    render(ProfileView, { store: storeWith([], []) });
    expect(await screen.findByText(/Save something to your library/)).toBeInTheDocument();
    expect(screen.getByText("Newcomer")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Progression" })).not.toBeInTheDocument();
  });

  it("says so when the activity can't be read", async () => {
    render(ProfileView, { store: storeWith(new Error("disk on fire")) });
    expect(await screen.findByRole("alert")).toHaveTextContent("disk on fire");
  });
});
