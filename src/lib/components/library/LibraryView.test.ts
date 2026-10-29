import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { page } from "$app/state";
import userEvent from "@testing-library/user-event";
import { levelOf } from "$lib/domain/gamification";
import LibraryPage from "./LibraryView.svelte";
import { LibraryStore } from "$lib/stores/library.svelte";
import { LibraryFilters } from "$lib/stores/libraryFilters.svelte";
import { manualEntry } from "$lib/stores/manualEntry.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entry(id: number, type: MediaType, status: LibraryStatus): LibraryEntry {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: `T${id}`,
      poster_path: null,
      year: null,
      poster_file: null,
    },
    user: { status, progress: 0, rating: null, review: null, length: emptyLength(), plan: null },
    created_at: "t",
    updated_at: `2026-09-2${id}T00:00:00Z`,
  };
}

async function storeWith(list: LibraryEntry[]) {
  const store = new LibraryStore({
    load: vi.fn(async () => list),
    add: vi.fn(),
    update: vi.fn(),
    plan: vi.fn(),
    remove: vi.fn(),
    posterDir: vi.fn(async () => "/data/posters"),
    retryPosters: vi.fn(async () => {}),
    addManual: vi.fn(),
    editManual: vi.fn(),
    mergePreview: vi.fn(),
    merge: vi.fn(),
    unmerge: vi.fn(),
    retypeManual: vi.fn(),
  });
  await store.hydrate();
  return store;
}

const search = () => screen.getByRole("searchbox", { name: "Search your library" });
const cards = () => screen.queryAllByRole("link", { name: /\bT\d\b/ });

describe("LibraryView: add manually", () => {
  it("the header opens the sheet for the type you filtered to", async () => {
    const open = vi.spyOn(manualEntry, "open").mockImplementation(() => {});
    const filters = new LibraryFilters();
    render(LibraryPage, {
      store: await storeWith([entry(1, "tv", "planning"), entry(2, "book", "planning")]),
      filters,
    });
    const add = screen.getByRole("button", { name: "Add manually" });
    await userEvent.click(add);
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ type: undefined }));
    filters.types = ["book"];
    await userEvent.click(await screen.findByRole("button", { name: "Add manually" }));
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ type: "book" }));
    open.mockRestore();
  });

  it("an empty library offers adding one yourself next to browsing", async () => {
    render(LibraryPage, { store: await storeWith([]), filters: new LibraryFilters() });
    expect(screen.getByRole("button", { name: "Add one yourself" })).toBeInTheDocument();
  });
});

describe("LibraryView", () => {
  it("keeps the Tree view reachable with an empty library", async () => {
    render(LibraryPage, {
      store: await storeWith([]),
      filters: new LibraryFilters(),
      progression: { loaded: true, error: "", level: levelOf(0) },
    });
    await userEvent.click(screen.getByRole("button", { name: "Tree" }));
    expect(screen.getByRole("region", { name: "Main progression tree" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Explore media trees" })).getAllByRole("button"),
    ).toHaveLength(6);
  });

  it("shows the empty state with a way to browse", async () => {
    render(LibraryPage, { store: await storeWith([]), filters: new LibraryFilters() });
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse/i })).toHaveAttribute("href", "/");
  });

  it("offers Log session on a planned card and notes today's time when due", async () => {
    const plan = { days: [0, 1, 2, 3, 4, 5, 6], max_session_minutes: 30, since: "2026-09-28" };
    const planned = entry(1, "tv", "in_progress");
    planned.user = {
      ...planned.user,
      plan,
      length: { ...emptyLength(), episodes: 9, episode_minutes: 30 },
    };
    const store = await storeWith([planned, entry(2, "tv", "planning")]);
    const tv = store.entries.find((e) => e.key === "tmdb:tv:1")!;
    const reminders = {
      data: {
        due: [{ entry: tv, family: "screen" as const, minutes: 30, finish: "2026-10-03" }],
        replanned: null,
      },
    };
    render(LibraryPage, { store, filters: new LibraryFilters(), reminders });
    expect(screen.queryByRole("region", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.getByText("30 min today")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Log a session of T1" }));
    expect(screen.getByRole("dialog", { name: "Log a session of T1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log a session of T2" })).not.toBeInTheDocument();
  });

  it("opens the plan sheet for a card and closes it on cancel", async () => {
    const store = await storeWith([entry(1, "tv", "in_progress"), entry(2, "movie", "dropped")]);
    render(LibraryPage, { store, filters: new LibraryFilters() });
    expect(screen.queryByRole("button", { name: "Plan T2" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Plan T1" }));
    const dialog = screen.getByRole("dialog", { name: "Plan T1" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters the grid by status and type", async () => {
    const store = await storeWith([
      entry(1, "movie", "planning"),
      entry(2, "tv", "in_progress"),
      entry(3, "tv", "planning"),
    ]);
    render(LibraryPage, { store, filters: new LibraryFilters(), narrowFilters: true });
    expect(cards()).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = within(screen.getByRole("dialog", { name: "Filters" }));
    await userEvent.click(
      within(dialog.getByRole("group", { name: "Status" })).getByRole("button", {
        name: /^planning/i,
      }),
    );
    expect(cards()).toHaveLength(2);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(
      within(screen.getByRole("group", { name: "Type" })).getByRole("button", {
        name: /^tv show/i,
      }),
    );
    expect(cards().map((a) => a.textContent)).toEqual([expect.stringContaining("T3")]);
    expect(screen.getByRole("button", { name: "Remove filter: Planning" })).toBeInTheDocument();
  });

  it("shows the items of every picked type", async () => {
    const store = await storeWith([
      entry(1, "movie", "planning"),
      entry(2, "tv", "planning"),
      entry(3, "game", "planning"),
    ]);
    render(LibraryPage, { store, filters: new LibraryFilters(), narrowFilters: true });
    const row = () => within(screen.getByRole("group", { name: "Type" }));
    await userEvent.click(row().getByRole("button", { name: /^movie/i }));
    expect(cards()).toHaveLength(1);
    await userEvent.click(row().getByRole("button", { name: /^game/i }));
    expect(cards()).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Filters, 2 on" })).toBeInTheDocument();
  });

  it("says when a filter matches nothing", async () => {
    // An empty status can't be picked, but a kept one can end up matching nothing.
    const filters = new LibraryFilters();
    filters.status = "dropped";
    render(LibraryPage, { store: await storeWith([entry(1, "movie", "planning")]), filters });
    expect(screen.getByText(/no dropped items/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove filter: Dropped" })).toBeInTheDocument();
  });

  it("narrows the grid by title as you type, with counts that follow", async () => {
    const store = await storeWith([
      entry(1, "movie", "planning"),
      entry(2, "tv", "in_progress"),
      entry(3, "tv", "planning"),
    ]);
    render(LibraryPage, { store, filters: new LibraryFilters(), narrowFilters: true });
    await userEvent.type(search(), "t2");
    expect(cards().map((a) => a.textContent)).toEqual([expect.stringContaining("T2")]);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const status = within(screen.getByRole("group", { name: "Status" }));
    expect(status.getByRole("button", { name: /^all 1/i })).toBeInTheDocument();
    expect(status.getByRole("button", { name: /^planning 0/i })).toBeDisabled();
  });

  it("says when no title matches and clearing restores the grid", async () => {
    const store = await storeWith([entry(1, "movie", "planning"), entry(2, "tv", "planning")]);
    render(LibraryPage, { store, filters: new LibraryFilters() });
    await userEvent.type(search(), "zzz");
    expect(cards()).toHaveLength(0);
    expect(screen.getByText("No titles match \u201czzz\u201d.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(cards()).toHaveLength(2);
  });

  it("keeps the search and filters when you come back", async () => {
    const store = await storeWith([entry(1, "movie", "planning"), entry(2, "tv", "planning")]);
    const filters = new LibraryFilters();
    const first = render(LibraryPage, { store, filters });
    await userEvent.type(search(), "t1");
    first.unmount();
    render(LibraryPage, { store, filters });
    expect(search()).toHaveValue("t1");
    expect(cards()).toHaveLength(1);
  });

  it("falls back to all types when the kept type is no longer in the library", async () => {
    const store = await storeWith([
      entry(1, "movie", "planning"),
      entry(2, "tv", "planning"),
      entry(3, "game", "planning"),
    ]);
    const filters = new LibraryFilters();
    filters.types = ["anime"];
    render(LibraryPage, { store, filters });
    expect(cards()).toHaveLength(3);
    const chips = within(screen.getByRole("group", { name: "Type" })).getAllByRole("button");
    expect(chips).toHaveLength(3);
    expect(chips.every((c) => c.getAttribute("aria-pressed") === "false")).toBe(true);
  });
});

describe("LibraryView: tree view", () => {
  const progression = { loaded: true, error: "", level: levelOf(2000) };
  const view = () => within(screen.getByRole("group", { name: "View" }));
  it("keeps the Grid default and replaces the grid with Tree", async () => {
    render(LibraryPage, {
      store: await storeWith([entry(1, "movie", "completed"), entry(2, "book", "planning")]),
      filters: new LibraryFilters(),
      progression,
    });
    expect(cards()).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Main progression tree" })).toBeNull();
    await userEvent.click(view().getByRole("button", { name: "Tree" }));
    expect(screen.getByRole("region", { name: "Main progression tree" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Movies" }));
    await userEvent.click(screen.getByText("Genres & saved items", { selector: "summary" }));
    expect(screen.getByRole("link", { name: "T1 Completed" })).toHaveAttribute(
      "href",
      "/media/movie/1",
    );
    expect(document.querySelector(".library-grid")).toBeNull();
  });
  it("shows which view is active", async () => {
    render(LibraryPage, { store: await storeWith([]), filters: new LibraryFilters(), progression });
    expect(view().getByRole("button", { name: "Grid", pressed: true })).toBeInTheDocument();
    await userEvent.click(view().getByRole("button", { name: "Tree" }));
    expect(view().getByRole("button", { name: "Tree", pressed: true })).toBeInTheDocument();
  });
  it("keeps the chosen view when you come back", async () => {
    const store = await storeWith([entry(1, "movie", "completed")]);
    const filters = new LibraryFilters();
    const first = render(LibraryPage, { store, filters, progression });
    await userEvent.click(view().getByRole("button", { name: "Tree" }));
    first.unmount();
    render(LibraryPage, { store, filters, progression });
    expect(filters.view).toBe("garden");
    expect(screen.getByRole("region", { name: "Main progression tree" })).toBeInTheDocument();
  });
  it("filters leaves without filtering the main tree, rewards or media selection", async () => {
    const filters = new LibraryFilters();
    filters.view = "garden";
    render(LibraryPage, {
      store: await storeWith([entry(1, "movie", "completed"), entry(2, "book", "planning")]),
      filters,
      progression,
    });
    const main = screen.getByRole("region", { name: "Main progression tree" });
    await userEvent.type(search(), "t2");
    expect(screen.getByRole("region", { name: "Main progression tree" })).toBe(main);
    expect(within(main).getByRole("button", { name: "Movies" })).toHaveTextContent("1 completed");
    await userEvent.click(screen.getByRole("button", { name: "Movies" }));
    await userEvent.click(screen.getByText("Genres & saved items", { selector: "summary" }));
    let detail = screen.getByRole("region", { name: "Movies subtree" });
    expect(within(detail).queryByRole("link")).toBeNull();
    expect(
      within(detail).getByRole("button", { name: "Preview Silver Screen tier 1" }),
    ).toHaveTextContent("Available");
    await userEvent.click(screen.getByRole("button", { name: "All media" }));
    page.state = {};
    fireEvent(window, new PopStateEvent("popstate"));
    await userEvent.click(
      within(await screen.findByRole("group", { name: "Explore media trees" })).getByRole(
        "button",
        {
          name: "Books",
        },
      ),
    );
    await userEvent.click(screen.getByText("Genres & saved items", { selector: "summary" }));
    expect(screen.getByRole("region", { name: "Books subtree" })).toHaveTextContent("T2");
    expect(filters.query).toBe("t2");
    expect(filters.types).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "All media" }));
    page.state = {};
    fireEvent(window, new PopStateEvent("popstate"));
    await userEvent.click(
      within(await screen.findByRole("group", { name: "Explore media trees" })).getByRole(
        "button",
        {
          name: "Movies",
        },
      ),
    );
    await userEvent.click(screen.getByText("Genres & saved items", { selector: "summary" }));
    detail = screen.getByRole("region", { name: "Movies subtree" });
    await userEvent.click(screen.getByRole("button", { name: "Clear tree filters" }));
    expect(filters.query).toBe("");
    expect(filters.status).toBe("all");
    expect(within(detail).getByRole("link", { name: "T1 Completed" })).toBeInTheDocument();
  });
  it("does not treat unsettled activity as current eligibility", async () => {
    const filters = new LibraryFilters();
    filters.view = "garden";
    const store = await storeWith([entry(1, "movie", "completed")]);
    render(LibraryPage, { store, filters, progression: { ...progression, loaded: false } });
    expect(screen.queryByRole("region", { name: "Main progression tree" })).toBeNull();
    expect(screen.getByRole("status", { name: "Tree availability" })).toBeInTheDocument();
  });
});
