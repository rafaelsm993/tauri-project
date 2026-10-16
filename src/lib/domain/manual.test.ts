import { describe, expect, it } from "vitest";
import {
  CREATOR_LABEL,
  applyDraft,
  duplicateOf,
  isManual,
  normalizeTitle,
  placeholderOf,
  splitTags,
} from "./manual";
import { detailPath } from "./libraryView";
import { emptyLength } from "./length";
import type { LibraryEntry, MediaSnapshot } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

const KEY = "manual:book:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";
// An accented title, for the accent-folding checks.
const AMELIE = "Amélie"; // english-only: allow

function saved(type: MediaType, title: string, year: string | null, key = `tmdb:${type}:1`) {
  return {
    key,
    snapshot: {
      media_key: key,
      provider: key.split(":")[0],
      media_type: type,
      title,
      poster_path: null,
      poster_file: null,
      year,
    },
    user: {
      status: "planning",
      progress: 0,
      rating: null,
      review: null,
      length: emptyLength(),
      plan: null,
    },
    created_at: "t",
    updated_at: "t",
  } as LibraryEntry;
}

describe("splitTags", () => {
  it("splits on commas, trims and drops blanks", () => {
    expect(splitTags("Sci-fi, drama ,")).toEqual(["Sci-fi", "drama"]);
    expect(splitTags("  ")).toEqual([]);
  });

  it("keeps the first spelling of a repeat, ignoring case", () => {
    expect(splitTags("RPG, rpg, Puzzle, RPG")).toEqual(["RPG", "Puzzle"]);
  });
});

describe("normalizeTitle", () => {
  it("ignores case, accents, punctuation and extra spaces", () => {
    expect(normalizeTitle(`  ${AMELIE}:  The Movie! `)).toBe(normalizeTitle("amelie the movie"));
    expect(normalizeTitle("Spider-Man")).toBe("spider man");
  });

  it("keeps non-Latin titles comparable instead of emptying them", () => {
    expect(normalizeTitle("進撃の巨人")).toBe("進撃の巨人");
  });
});

describe("duplicateOf", () => {
  const library = [
    saved("movie", AMELIE, "2001"),
    saved("book", "Dune", null, "itunes:book:9"),
    saved("game", "Hades", "2020"),
  ];

  it("finds the same type and title, whatever the provider", () => {
    expect(duplicateOf(library, { media_type: "movie", title: "amelie" })?.key).toBe(
      "tmdb:movie:1",
    );
    expect(duplicateOf(library, { media_type: "book", title: " DUNE " })?.key).toBe(
      "itunes:book:9",
    );
  });

  it("is not a duplicate across types", () => {
    expect(duplicateOf(library, { media_type: "tv", title: AMELIE })).toBeUndefined();
  });

  it("uses the year only when both sides have one", () => {
    expect(
      duplicateOf(library, { media_type: "game", title: "Hades", year: "2024" }),
    ).toBeUndefined();
    expect(
      duplicateOf(library, { media_type: "game", title: "Hades", year: "2020" }),
    ).toBeDefined();
    expect(duplicateOf(library, { media_type: "book", title: "Dune", year: "1965" })).toBeDefined();
    expect(duplicateOf(library, { media_type: "game", title: "Hades", year: " " })).toBeDefined();
  });

  it("skips the item being edited and never matches a blank title", () => {
    const own = saved("book", "Dune", null, KEY);
    expect(duplicateOf([own], { media_type: "book", title: "Dune" }, KEY)).toBeUndefined();
    expect(
      duplicateOf([saved("book", "", null)], { media_type: "book", title: "  " }),
    ).toBeUndefined();
  });
});

describe("placeholderOf", () => {
  it("is the first letter or digit, upper-cased, with the type's family hue", () => {
    expect(placeholderOf("dune", "book")).toEqual({ initial: "D", family: "book" });
    expect(placeholderOf('"1984"', "book").initial).toBe("1");
    expect(placeholderOf("Arcane", "tv")).toEqual({ initial: "A", family: "screen" });
    expect(placeholderOf("進撃の巨人", "anime").initial).toBe("進");
  });

  it("falls back to a neutral mark when there is nothing to show", () => {
    expect(placeholderOf("  ", "game").initial).toBe("?");
  });
});

describe("CREATOR_LABEL", () => {
  it("names the creator the way each type does", () => {
    expect(CREATOR_LABEL).toEqual({
      movie: "Director",
      tv: "Creator",
      anime: "Studio",
      manga: "Author",
      book: "Author",
      game: "Developer",
    });
  });
});

describe("manual keys", () => {
  it("isManual tells manual keys from provider keys", () => {
    expect(isManual(KEY)).toBe(true);
    expect(isManual("tmdb:movie:1")).toBe(false);
    expect(isManual("manualish:movie:1")).toBe(false);
  });

  it("a manual entry routes to its own type and uuid", () => {
    expect(detailPath(saved("book", "Dune", null, KEY))).toEqual({
      type: "book",
      id: "0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69",
    });
  });
});

describe("applyDraft", () => {
  const before: MediaSnapshot = {
    ...saved("game", "Hades", "2020", "manual:game:x").snapshot,
    provider: "manual",
    poster_file: "mine.jpg",
    creator: "Supergiant",
    platforms: ["PC"],
  };

  it("replaces the text the way Rust tidies it and keeps key, type and poster", () => {
    const after = applyDraft(before, {
      media_type: "game",
      title: "  Hades II ",
      year: "",
      creator: " ",
      genres: ["Roguelike", "roguelike", " "],
      platforms: ["PC", "Switch"],
    });
    expect(after).toEqual({
      ...before,
      title: "Hades II",
      year: null,
      creator: undefined,
      overview: undefined,
      genres: ["Roguelike"],
      platforms: ["PC", "Switch"],
    });
  });

  it("drops platforms for anything but a game", () => {
    const book = { ...before, media_type: "book" as const };
    const after = applyDraft(book, { media_type: "book", title: "X", platforms: ["PC"] });
    expect(after.platforms).toEqual([]);
  });
});
