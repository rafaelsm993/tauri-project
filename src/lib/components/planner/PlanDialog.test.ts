import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import PlanDialog from "./PlanDialog.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaDetail } from "$lib/types/media";

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

async function setup(
  over: Partial<LibraryClient> = {},
  entry: LibraryEntry = BOOK,
  saved: Partial<typeof DEFAULT_PREFS> = {},
  props: Record<string, unknown> = {},
) {
  const client: LibraryClient = {
    load: vi.fn(async () => [entry]),
    add: vi.fn(),
    update: vi.fn(async () => BOOK),
    plan: vi.fn(async (_k, plan) => ({ ...BOOK, user: { ...BOOK.user, plan } })),
    remove: vi.fn(),
    posterDir: vi.fn(async () => "/p"),
    retryPosters: vi.fn(async () => {}),
    addManual: vi.fn(),
    editManual: vi.fn(),
    mergePreview: vi.fn(),
    merge: vi.fn(),
    unmerge: vi.fn(),
    retypeManual: vi.fn(),
    ...over,
  };
  const library = new LibraryStore(client);
  await library.hydrate();
  const prefsUpdate = vi.fn(async (patch) => ({ ...DEFAULT_PREFS, ...patch }));
  const prefs = new PrefsStore({
    load: vi.fn(async () => ({ ...DEFAULT_PREFS, ...saved })),
    update: prefsUpdate,
  });
  await prefs.hydrate();
  const onclose = vi.fn();
  render(PlanDialog, {
    entry,
    today: "2026-10-01",
    library,
    prefs,
    onclose,
    catalogApi: { fetchDetail: vi.fn().mockRejectedValue("offline") },
    ...props,
  });
  return { client, prefsUpdate, onclose };
}

const GHOUL = {
  ...BOOK,
  key: "tmdb:tv:61374",
  snapshot: {
    ...BOOK.snapshot,
    media_key: "tmdb:tv:61374",
    provider: "tmdb",
    media_type: "tv",
    title: "Tokyo Ghoul",
  },
  user: { ...BOOK.user, length: { ...emptyLength(), episodes: 48 }, plan: null },
} as LibraryEntry;

const detail = (over: Partial<MediaDetail>) =>
  ({
    id: 61374,
    provider: "tmdb",
    media_key: "tmdb:tv:61374",
    media_type: "tv",
    title: "Tokyo Ghoul",
    tagline: "",
    overview: "",
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    release_date: "",
    runtime: null,
    genres: [],
    cast: [],
    videos: [],
    ...over,
  }) as MediaDetail;

describe("PlanDialog", () => {
  describe("a length from the catalog", () => {
    it("asks the catalog for a missing length and fills it before the sheet shows", async () => {
      const fetchDetail = vi.fn().mockResolvedValue(detail({ episodes: 48, runtime: 24 }));
      await setup({}, GHOUL, {}, { catalogApi: { fetchDetail } });
      expect(await screen.findByLabelText("Minutes per episode")).toHaveValue(24);
      expect(fetchDetail).toHaveBeenCalledWith("tv", "61374");
    });

    it("uses the detail it was given instead of asking again", async () => {
      const fetchDetail = vi.fn();
      await setup({}, GHOUL, {}, { catalogApi: { fetchDetail }, detail: detail({ runtime: 24 }) });
      expect(screen.getByLabelText("Minutes per episode")).toHaveValue(24);
      expect(fetchDetail).not.toHaveBeenCalled();
    });

    it("still opens, with the field empty, when the catalog cannot be reached", async () => {
      await setup({}, GHOUL);
      expect(await screen.findByLabelText("Minutes per episode")).toHaveValue(null);
    });

    it("never asks for what no catalog has, like a book's pages", async () => {
      const fetchDetail = vi.fn();
      const noPages = { ...BOOK, user: { ...BOOK.user, length: emptyLength() } } as LibraryEntry;
      await setup({}, noPages, {}, { catalogApi: { fetchDetail } });
      expect(screen.getByLabelText(/^pages$/i)).toBeInTheDocument();
      expect(fetchDetail).not.toHaveBeenCalled();
    });

    it("never asks about a hand-made item", async () => {
      const fetchDetail = vi.fn();
      const mine = {
        ...GHOUL,
        key: "manual:tv:abc",
        snapshot: { ...GHOUL.snapshot, provider: "manual", media_key: "manual:tv:abc" },
      } as LibraryEntry;
      await setup({}, mine, {}, { catalogApi: { fetchDetail } });
      expect(screen.getByLabelText("Minutes per episode")).toBeInTheDocument();
      expect(fetchDetail).not.toHaveBeenCalled();
    });
  });

  it("is a labelled dialog that closes on Escape", async () => {
    const { onclose } = await setup();
    expect(screen.getByRole("dialog", { name: "Plan Dune" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onclose).toHaveBeenCalled();
  });

  it("opens on the sheet, not the pace field, so a phone keyboard stays down", async () => {
    await setup({}, BOOK, { reading_pages_per_hour: 45 });
    expect(screen.getByRole("dialog", { name: "Plan Dune" })).toHaveFocus();
    expect(screen.getByLabelText(/pages per hour/i)).not.toHaveFocus();
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

  it("saves no pace when the saved one was kept", async () => {
    const { client, prefsUpdate } = await setup({}, BOOK, { reading_pages_per_hour: 45 });
    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(prefsUpdate).not.toHaveBeenCalled();
    expect(client.plan).toHaveBeenCalled();
  });

  it("gives a manga without minutes per chapter the Settings default, and saves it", async () => {
    const manga = {
      ...BOOK,
      key: "anilist:manga:1",
      snapshot: { ...BOOK.snapshot, media_key: "anilist:manga:1", media_type: "manga" },
      user: { ...BOOK.user, length: { ...emptyLength(), chapters: 100 }, plan: null },
    } as LibraryEntry;
    const { client } = await setup({ update: vi.fn(async () => manga) }, manga, {
      manga_chapter_minutes: 6,
    });
    expect(screen.getByLabelText("Minutes per chapter")).toHaveValue(6);
    await userEvent.click(screen.getByRole("button", { name: "Mon" }));
    await userEvent.click(screen.getByRole("button", { name: /save plan/i }));
    expect(client.update).toHaveBeenCalledWith(manga.key, {
      length: expect.objectContaining({ chapter_minutes: 6 }),
    });
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
      addManual: vi.fn(),
      editManual: vi.fn(),
      mergePreview: vi.fn(),
      merge: vi.fn(),
      unmerge: vi.fn(),
      retypeManual: vi.fn(),
    };
    const library = new LibraryStore(client);
    await library.hydrate();
    const prefs = new PrefsStore({
      load: vi.fn(async () => DEFAULT_PREFS),
      update: vi.fn(async () => DEFAULT_PREFS),
    });
    const onclose = vi.fn();
    const catalogApi = { fetchDetail: vi.fn().mockRejectedValue("offline") };
    render(PlanDialog, { entry: tv, today: "2026-10-01", library, prefs, onclose, catalogApi });
    await userEvent.type(await screen.findByLabelText(/minutes per episode/i), "40");
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
      addManual: vi.fn(),
      editManual: vi.fn(),
      mergePreview: vi.fn(),
      merge: vi.fn(),
      unmerge: vi.fn(),
      retypeManual: vi.fn(),
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
