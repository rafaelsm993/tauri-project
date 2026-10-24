import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  continueEntries,
  continueItems,
  detailPath,
  filterEntries,
  normalizeTitle,
  searchEntries,
  statusOptions,
  typeOptions,
  withEmptyDisabled,
} from "./libraryView";
import { emptyLength } from "./length";
import type { DueSession } from "./reminders";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entry(key: string, type: MediaType, status: LibraryStatus): LibraryEntry {
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: key,
      poster_path: null,
      year: null,
      poster_file: null,
    },
    user: { status, progress: 0, rating: null, review: null, length: emptyLength(), plan: null },
    created_at: "t",
    updated_at: "t",
  };
}

const LIST = [
  entry("tmdb:movie:1", "movie", "planning"),
  entry("tmdb:tv:2", "tv", "in_progress"),
  entry("anilist:anime:3", "anime", "in_progress"),
  entry("rawg:game:4", "game", "completed"),
];

describe("filterEntries", () => {
  it("returns everything for all/all", () => {
    expect(filterEntries(LIST, { status: "all", type: "all" })).toHaveLength(4);
  });

  it("filters by status and type together", () => {
    const out = filterEntries(LIST, { status: "in_progress", type: "tv" });
    expect(out.map((e) => e.key)).toEqual(["tmdb:tv:2"]);
  });

  it("keeps the incoming order", () => {
    const out = filterEntries(LIST, { status: "in_progress", type: "all" });
    expect(out.map((e) => e.key)).toEqual(["tmdb:tv:2", "anilist:anime:3"]);
  });
});

describe("statusOptions", () => {
  it("starts with All and counts each status within the chosen type", () => {
    const opts = statusOptions(LIST, "all");
    expect(opts[0]).toEqual({ value: "all", label: "All", count: 4 });
    expect(opts.find((o) => o.value === "in_progress")?.count).toBe(2);
    expect(statusOptions(LIST, "tv").find((o) => o.value === "in_progress")?.count).toBe(1);
  });
});

describe("typeOptions", () => {
  it("lists All plus only the types present in the library", () => {
    expect(typeOptions(LIST).map((o) => o.value)).toEqual(["all", "movie", "tv", "anime", "game"]);
  });

  it("keeps the library's types while counting only the matching entries", () => {
    const counts = typeOptions([LIST[1]], LIST).map((o) => [o.value, o.count]);
    expect(counts).toEqual([
      ["all", 1],
      ["movie", 0],
      ["tv", 1],
      ["anime", 0],
      ["game", 0],
    ]);
  });
});

describe("detailPath", () => {
  it("splits the media key into type and id", () => {
    expect(detailPath(LIST[1])).toEqual({ type: "tv", id: "2" });
  });

  it("keeps colons that belong to the id", () => {
    expect(detailPath(entry("itunes:book:a:b", "book", "planning"))).toEqual({
      type: "book",
      id: "a:b",
    });
  });
});

describe("normalizeTitle", () => {
  it("lowercases, strips accents and collapses spaces", () => {
    expect(normalizeTitle("  Pok\u00e9mon   \u00c9l  Ni\u00f1o ")).toBe("pokemon el nino");
  });
});

describe("searchEntries", () => {
  const titled = (title: string) => ({
    ...entry(`k:${title}`, "movie", "planning"),
    snapshot: { ...entry("x", "movie", "planning").snapshot, title },
  });
  const BOOKS = [titled("The Dark Knight"), titled("Pok\u00e9mon Heroes"), titled("Am\u00e9lie")];
  const titles = (q: string) => searchEntries(BOOKS, q).map((e) => e.snapshot.title);

  it("returns the list as is for a blank query", () => {
    expect(searchEntries(BOOKS, "")).toBe(BOOKS);
    expect(searchEntries(BOOKS, "   ")).toBe(BOOKS);
  });

  it("matches a substring regardless of case", () => {
    expect(titles("DARK")).toEqual(["The Dark Knight"]);
    expect(titles("nig")).toEqual(["The Dark Knight"]);
  });

  it("ignores accents in either the title or the query", () => {
    expect(titles("pokemon")).toEqual(["Pok\u00e9mon Heroes"]);
    expect(titles("AM\u00c9LIE")).toEqual(["Am\u00e9lie"]);
    expect(titles("amelie")).toEqual(["Am\u00e9lie"]);
  });

  it("needs every word, in any order", () => {
    expect(titles("knight dark")).toEqual(["The Dark Knight"]);
    expect(titles("dark heroes")).toEqual([]);
  });
});

describe("continueEntries", () => {
  it("in-progress only, most recently updated first, at most 12", () => {
    const list = Array.from({ length: 14 }, (_, i) => ({
      ...entry(`tmdb:movie:${i}`, "movie", "in_progress"),
      updated_at: `2026-10-${10 + i}T00:00:00Z`,
    }));
    list.push({
      ...entry("tmdb:movie:99", "movie", "completed"),
      updated_at: "2026-10-30T00:00:00Z",
    });
    const out = continueEntries(list);
    expect(out).toHaveLength(12);
    expect(out[0].key).toBe("tmdb:movie:13");
    expect(out.every((e) => e.user.status === "in_progress")).toBe(true);
  });
});

describe("continueItems", () => {
  const due = (e: LibraryEntry, minutes: number): DueSession => ({
    entry: e,
    family: "screen",
    minutes,
    finish: "2026-10-30",
  });

  it("puts today's sessions first, in the planner's order, then the rest without repeats", () => {
    const a = { ...entry("tmdb:tv:1", "tv", "in_progress"), updated_at: "2026-10-20T00:00:00Z" };
    const b = { ...entry("tmdb:tv:2", "tv", "in_progress"), updated_at: "2026-10-21T00:00:00Z" };
    const c = { ...entry("tmdb:tv:3", "tv", "in_progress"), updated_at: "2026-10-22T00:00:00Z" };
    const out = continueItems([a, b, c], [due(a, 90), due(b, 30)]);
    expect(out.map((i) => i.entry.key)).toEqual(["tmdb:tv:1", "tmdb:tv:2", "tmdb:tv:3"]);
    expect(out.map((i) => i.dueMinutes)).toEqual([90, 30, null]);
  });

  it("includes a Planning item that has a session today", () => {
    // Continue alone lists In progress only; its Log session would exist nowhere on Home.
    const planned = entry("tmdb:movie:5", "movie", "planning");
    expect(continueItems([planned], [due(planned, 45)]).map((i) => i.entry.key)).toEqual([
      "tmdb:movie:5",
    ]);
  });

  it("never drops a due session to the 12-card cap", () => {
    const list = Array.from({ length: 14 }, (_, i) => entry(`tmdb:tv:${i}`, "tv", "in_progress"));
    const out = continueItems(
      list,
      list.slice(0, 13).map((e) => due(e, 30)),
    );
    expect(out).toHaveLength(13);
    expect(out.every((i) => i.dueMinutes !== null)).toBe(true);
  });

  it("fills up to the cap with the rest", () => {
    const list = Array.from({ length: 14 }, (_, i) => entry(`tmdb:tv:${i}`, "tv", "in_progress"));
    expect(continueItems(list, [due(list[0], 30)])).toHaveLength(12);
  });
});

describe("filter bar helpers", () => {
  const options = [
    { value: "all", label: "All", count: 3 },
    { value: "planning", label: "Planning", count: 3 },
    { value: "dropped", label: "Dropped", count: 0 },
    { value: "completed", label: "Completed", count: 0 },
  ];

  it("disables options with no items, except the one picked", () => {
    expect(withEmptyDisabled(options, "completed").map((o) => o.disabled)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it("counts the filters that narrow the library", () => {
    expect(activeFilterCount({ status: "all", type: "all" })).toBe(0);
    expect(activeFilterCount({ status: "planning", type: "all" })).toBe(1);
    expect(activeFilterCount({ status: "planning", type: "tv" })).toBe(2);
  });
});
