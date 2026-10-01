import { describe, expect, it, vi } from "vitest";

// jsdom has no matchMedia (reduce-motion) and no getAnimations (animate:flip).
vi.hoisted(() => {
  Element.prototype.getAnimations ??= () => [];
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
});
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import PlannerView from "./PlannerView.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";
import { emptyLength } from "$lib/domain/length";
import type { Length, LibraryEntry, Plan } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

const MWF: Plan = { days: [0, 2, 4], max_session_minutes: 60, since: "2026-09-28" };

function entry(
  id: number,
  type: MediaType,
  title: string,
  length: Partial<Length>,
  plan: Plan | null,
) {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status: "in_progress",
      progress: 0,
      rating: null,
      review: null,
      length: { ...emptyLength(), ...length },
      plan,
    },
    created_at: "",
    updated_at: "",
  } as LibraryEntry;
}

const FRIEREN = entry(1, "anime", "Frieren", { episodes: 6, episode_minutes: 20 }, MWF);
const BERSERK = entry(2, "manga", "Berserk", { chapters: 300 }, MWF);
const DUNE = entry(3, "book", "Dune", { pages: 400 }, null);

async function stores(list: LibraryEntry[]) {
  const client: LibraryClient = {
    load: vi.fn(async () => list),
    add: vi.fn(),
    update: vi.fn(async (key: string, patch) => ({
      ...list.find((e) => e.key === key)!,
      user: { ...list.find((e) => e.key === key)!.user, ...patch },
    })),
    plan: vi.fn(async (key: string, plan: Plan | null) => ({
      ...list.find((e) => e.key === key)!,
      user: { ...list.find((e) => e.key === key)!.user, plan },
    })),
    remove: vi.fn(),
    posterDir: vi.fn(async () => "/p"),
    retryPosters: vi.fn(async () => {}),
  };
  const library = new LibraryStore(client);
  await library.hydrate();
  const prefs = new PrefsStore({
    load: vi.fn(async () => DEFAULT_PREFS),
    update: vi.fn(async (patch) => ({ ...DEFAULT_PREFS, ...patch })),
  });
  await prefs.hydrate();
  return { library, prefs, client };
}

const TODAY = "2026-10-01";

describe("PlannerView", () => {
  it("says nothing is planned yet and points to the library", async () => {
    const { library, prefs } = await stores([DUNE]);
    render(PlannerView, { library, prefs, today: TODAY, motion: false });
    expect(screen.getByText(/nothing planned yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /library/i })).toHaveAttribute("href", "/library");
  });

  it("lays out this week's sessions and lists each plan with its finish date", async () => {
    const { library, prefs } = await stores([FRIEREN, DUNE]);
    render(PlannerView, { library, prefs, today: TODAY, motion: false });
    expect(screen.getByRole("heading", { name: /week of mon, sep 28/i })).toBeInTheDocument();
    const fri = screen.getByRole("listitem", { name: "Fri, Oct 2" });
    expect(within(fri).getByLabelText("Frieren, 1 h")).toBeInTheDocument();
    const plans = screen.getByRole("list", { name: /plans/i });
    expect(within(plans).getByText("Frieren")).toBeInTheDocument();
    expect(within(plans).getByText(/finishes mon, oct 5/i)).toBeInTheDocument();
    expect(within(plans).queryByText("Dune")).not.toBeInTheDocument();
  });

  it("moves a week at a time and comes back to this week", async () => {
    const { library, prefs } = await stores([FRIEREN]);
    render(PlannerView, { library, prefs, today: TODAY, motion: false });
    await userEvent.click(screen.getByRole("button", { name: /next week/i }));
    expect(screen.getByRole("heading", { name: /week of mon, oct 5/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /this week/i }));
    expect(screen.getByRole("heading", { name: /week of mon, sep 28/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /previous week/i }));
    expect(screen.getByRole("heading", { name: /week of mon, sep 21/i })).toBeInTheDocument();
  });

  it("lists plans that still need a length, and plans them from there", async () => {
    const { library, prefs, client } = await stores([BERSERK]);
    render(PlannerView, { library, prefs, today: TODAY, motion: false });
    const needs = screen.getByRole("list", { name: /needs a length/i });
    await userEvent.click(within(needs).getByRole("button", { name: /plan berserk/i }));
    const dialog = screen.getByRole("dialog", { name: /plan berserk/i });
    await userEvent.type(within(dialog).getByLabelText(/minutes per chapter/i), "5");
    await userEvent.click(within(dialog).getByRole("button", { name: /save plan/i }));
    expect(client.update).toHaveBeenCalledWith(
      BERSERK.key,
      expect.objectContaining({ length: expect.objectContaining({ chapter_minutes: 5 }) }),
    );
    expect(client.plan).toHaveBeenCalledWith(
      BERSERK.key,
      expect.objectContaining({ days: [0, 2, 4] }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edits a plan from the list", async () => {
    const { library, prefs } = await stores([FRIEREN]);
    render(PlannerView, { library, prefs, today: TODAY, motion: false });
    const plans = screen.getByRole("list", { name: /plans/i });
    await userEvent.click(within(plans).getByRole("button", { name: /edit frieren/i }));
    expect(screen.getByRole("dialog", { name: /plan frieren/i })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
