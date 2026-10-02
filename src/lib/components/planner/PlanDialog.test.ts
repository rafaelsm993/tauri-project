import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import PlanDialog from "./PlanDialog.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";

const BOOK = {
  key: "itunes:book:1",
  snapshot: {
    media_key: "itunes:book:1",
    provider: "itunes",
    media_type: "book",
    title: "Dune",
    poster_path: null,
    poster_file: null,
    year: null,
  },
  user: {
    status: "planning",
    progress: 0,
    rating: null,
    review: null,
    length: { ...emptyLength(), pages: 400 },
    plan: { days: [0], max_session_minutes: 60, since: "2026-09-28" },
  },
  created_at: "",
  updated_at: "",
} as LibraryEntry;

async function setup(over: Partial<LibraryClient> = {}) {
  const client: LibraryClient = {
    load: vi.fn(async () => [BOOK]),
    add: vi.fn(),
    update: vi.fn(async () => BOOK),
    plan: vi.fn(async (_k, plan) => ({ ...BOOK, user: { ...BOOK.user, plan } })),
    remove: vi.fn(),
    posterDir: vi.fn(async () => "/p"),
    retryPosters: vi.fn(async () => {}),
    ...over,
  };
  const library = new LibraryStore(client);
  await library.hydrate();
  const prefsUpdate = vi.fn(async (patch) => ({ ...DEFAULT_PREFS, ...patch }));
  const prefs = new PrefsStore({ load: vi.fn(async () => DEFAULT_PREFS), update: prefsUpdate });
  await prefs.hydrate();
  const onclose = vi.fn();
  render(PlanDialog, { entry: BOOK, today: "2026-10-01", library, prefs, onclose });
  return { client, prefsUpdate, onclose };
}

describe("PlanDialog", () => {
  it("is a labelled dialog that closes on Escape", async () => {
    const { onclose } = await setup();
    expect(screen.getByRole("dialog", { name: "Plan Dune" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onclose).toHaveBeenCalled();
  });

  it("saves the reading pace once, then the plan, then closes", async () => {
    const { client, prefsUpdate, onclose } = await setup();
    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(prefsUpdate).toHaveBeenCalledWith({ reading_pages_per_hour: 30 });
    expect(client.update).not.toHaveBeenCalled();
    expect(client.plan).toHaveBeenCalledWith(BOOK.key, {
      days: [0],
      max_session_minutes: 60,
      since: "2026-10-01",
    });
    expect(onclose).toHaveBeenCalled();
  });

  it("stays open and saves no plan when a step fails", async () => {
    const { client, onclose } = await setup({
      plan: vi.fn(async () => {
        throw new Error("a plan needs at least one day");
      }),
    });
    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(onclose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/at least one day/i);
    expect(client.plan).toHaveBeenCalledTimes(1);
  });

  it("does not save the plan when the length could not be saved", async () => {
    const tv = {
      ...BOOK,
      key: "tmdb:tv:9",
      snapshot: { ...BOOK.snapshot, media_key: "tmdb:tv:9", media_type: "tv", title: "Arcane" },
      user: { ...BOOK.user, length: { ...emptyLength(), episodes: 9 } },
    } as LibraryEntry;
    const update = vi.fn(async () => {
      throw new Error("disk full");
    });
    const plan = vi.fn();
    const client: LibraryClient = {
      load: vi.fn(async () => [tv]),
      add: vi.fn(),
      update,
      plan,
      remove: vi.fn(),
      posterDir: vi.fn(async () => "/p"),
      retryPosters: vi.fn(async () => {}),
    };
    const library = new LibraryStore(client);
    await library.hydrate();
    const prefs = new PrefsStore({
      load: vi.fn(async () => DEFAULT_PREFS),
      update: vi.fn(async () => DEFAULT_PREFS),
    });
    const onclose = vi.fn();
    render(PlanDialog, { entry: tv, today: "2026-10-01", library, prefs, onclose });
    await userEvent.type(screen.getByLabelText(/minutes per episode/i), "40");
    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(update).toHaveBeenCalled();
    expect(plan).not.toHaveBeenCalled();
    expect(onclose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/disk full/i);
  });

  it("trusts the save's answer, not an error another save cleared meanwhile", async () => {
    const plan = vi.fn(async () => BOOK);
    const library = new LibraryStore({
      load: vi.fn(async () => [BOOK]),
      add: vi.fn(),
      update: vi.fn(async () => BOOK),
      plan,
      remove: vi.fn(),
      posterDir: vi.fn(async () => "/p"),
      retryPosters: vi.fn(async () => {}),
    });
    await library.hydrate();
    const prefs = new PrefsStore({
      load: vi.fn(async () => DEFAULT_PREFS),
      update: vi.fn(async () => DEFAULT_PREFS),
    });
    vi.spyOn(prefs, "update").mockResolvedValue(false);
    const onclose = vi.fn();
    render(PlanDialog, { entry: BOOK, today: "2026-10-01", library, prefs, onclose });
    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(prefs.error).toBe("");
    expect(plan).not.toHaveBeenCalled();
    expect(onclose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be saved/i);
  });

  it("stops planning", async () => {
    const { client, onclose } = await setup();
    await userEvent.click(screen.getByRole("button", { name: /stop planning/i }));
    expect(client.plan).toHaveBeenCalledWith(BOOK.key, null);
    expect(onclose).toHaveBeenCalled();
  });
});
