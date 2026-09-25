import { describe, expect, it } from "vitest";
import { detailPath, filterEntries, statusOptions, typeOptions } from "./libraryView";
import { emptyLength } from "./length";
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
    user: { status, progress: 0, rating: null, review: null, length: emptyLength() },
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
