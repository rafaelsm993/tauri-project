import { describe, expect, it } from "vitest";
import { growth, plantOf, scene, seedOf, stageOf } from "./garden";
import type { Length, LibraryEntry, LibraryStatus, UserData } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

const noLength: Length = {
  runtime_minutes: null,
  episodes: null,
  episode_minutes: null,
  chapters: null,
  chapter_minutes: null,
  pages: null,
  hours: null,
};

function entry(
  key: string,
  status: LibraryStatus,
  opts: {
    type?: MediaType;
    title?: string;
    progress?: number;
    length?: Partial<Length>;
    updated?: string;
  } = {},
): LibraryEntry {
  const type = opts.type ?? "book";
  const user: UserData = {
    status,
    progress: opts.progress ?? 0,
    rating: null,
    review: null,
    length: { ...noLength, ...opts.length },
    plan: null,
  };
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "manual",
      media_type: type,
      title: opts.title ?? "Title",
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: opts.updated ?? "2026-01-01T00:00:00Z",
  };
}

describe("stageOf", () => {
  it("maps each status to its stage", () => {
    expect(stageOf(entry("a", "planning"))).toBe("seed");
    expect(stageOf(entry("a", "in_progress"))).toBe("sprout");
    expect(stageOf(entry("a", "completed"))).toBe("bloom");
    expect(stageOf(entry("a", "dropped"))).toBe("dormant");
  });

  it("keeps a dropped item dormant however far it got", () => {
    const far = entry("a", "dropped", { progress: 300, length: { pages: 300 } });
    expect(stageOf(far)).toBe("dormant");
    expect(growth(far)).toBe(0);
  });
});

describe("growth", () => {
  it("is the progress fraction while in progress", () => {
    expect(growth(entry("a", "in_progress", { progress: 150, length: { pages: 300 } }))).toBe(0.5);
  });

  it("is full when completed and empty when planning", () => {
    expect(growth(entry("a", "completed"))).toBe(1);
    expect(growth(entry("a", "planning", { progress: 10, length: { pages: 100 } }))).toBe(0);
  });

  it("stays inside 0..1 when progress passes the length", () => {
    expect(growth(entry("a", "in_progress", { progress: 400, length: { pages: 300 } }))).toBe(1);
  });

  it("shows a started item without a known length as a visible sprout", () => {
    const unknown = entry("a", "in_progress", { progress: 12 });
    expect(growth(unknown)).toBeGreaterThan(0);
    expect(growth(unknown)).toBeLessThan(1);
  });

  it("is empty for an in-progress item with no progress yet", () => {
    expect(growth(entry("a", "in_progress"))).toBe(0);
  });
});

describe("seedOf", () => {
  it("is stable for the same key and differs between keys", () => {
    expect(seedOf("itunes:book:42")).toBe(seedOf("itunes:book:42"));
    expect(seedOf("itunes:book:42")).not.toBe(seedOf("itunes:book:43"));
  });

  it("is a non-negative integer", () => {
    for (const key of ["a", "tmdb:movie:1", "manual:game:7f3e-aa", ""]) {
      const seed = seedOf(key);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("plantOf", () => {
  it("carries the family, stage and growth of the entry", () => {
    const plant = plantOf(entry("tmdb:movie:1", "completed", { type: "movie", title: "Dune" }));
    expect(plant).toMatchObject({ key: "tmdb:movie:1", family: "screen", stage: "bloom" });
    expect(plant.growth).toBe(1);
  });

  it("folds movies and TV into one family and keeps the others apart", () => {
    const family = (type: MediaType) => plantOf(entry("k", "planning", { type })).family;
    expect(family("movie")).toBe("screen");
    expect(family("tv")).toBe("screen");
    expect(family("anime")).toBe("anime");
    expect(family("game")).toBe("game");
  });

  it("varies tilt and height by key but never outside the bounds", () => {
    const plants = ["a", "b", "c", "d", "e", "f", "g", "h"].map((k) =>
      plantOf(entry(k, "completed")),
    );
    for (const p of plants) {
      expect(p.tilt).toBeGreaterThanOrEqual(-6);
      expect(p.tilt).toBeLessThanOrEqual(6);
      expect(p.height).toBeGreaterThanOrEqual(0.85);
      expect(p.height).toBeLessThanOrEqual(1.15);
    }
    expect(new Set(plants.map((p) => p.tilt)).size).toBeGreaterThan(1);
  });

  it("gives the same entry the same plant every time", () => {
    const e = entry("manual:book:x", "in_progress", { progress: 3, length: { pages: 10 } });
    expect(plantOf(e)).toEqual(plantOf(e));
  });

  it("names the plant for a screen reader", () => {
    const plant = plantOf(entry("k", "completed", { type: "book", title: "Piranesi" }));
    expect(plant.label).toBe("Piranesi, book, completed");
  });
});

describe("scene", () => {
  it("keeps the newest activity first", () => {
    const entries = [
      entry("old", "completed", { updated: "2026-01-01T00:00:00Z" }),
      entry("new", "completed", { updated: "2026-03-01T00:00:00Z" }),
      entry("mid", "completed", { updated: "2026-02-01T00:00:00Z" }),
    ];
    expect(scene(entries).plants.map((p) => p.key)).toEqual(["new", "mid", "old"]);
  });

  it("caps the plants and reports how many are left", () => {
    const entries = Array.from({ length: 130 }, (_, i) =>
      entry(`k${i}`, "completed", { updated: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z` }),
    );
    const result = scene(entries);
    expect(result.plants).toHaveLength(120);
    expect(result.more).toBe(10);
  });

  it("reports nothing left when the library fits", () => {
    expect(scene([entry("a", "planning")]).more).toBe(0);
    expect(scene([]).plants).toEqual([]);
  });

  it("takes a smaller cap", () => {
    const entries = [entry("a", "planning"), entry("b", "planning"), entry("c", "planning")];
    const result = scene(entries, 2);
    expect(result.plants).toHaveLength(2);
    expect(result.more).toBe(1);
  });

  it("builds the same scene twice from the same library", () => {
    const entries = [entry("a", "completed"), entry("b", "in_progress", { progress: 1 })];
    expect(scene(entries)).toEqual(scene(entries));
  });

  it("does not reshuffle when an unrelated item is added", () => {
    const a = entry("a", "completed", { updated: "2026-01-02T00:00:00Z" });
    const b = entry("b", "completed", { updated: "2026-01-01T00:00:00Z" });
    const before = scene([a, b]).plants;
    const after = scene([a, b, entry("c", "planning", { updated: "2026-01-03T00:00:00Z" })]).plants;
    const same = (key: string) => [
      before.find((p) => p.key === key),
      after.find((p) => p.key === key),
    ];
    const [beforeA, afterA] = same("a");
    expect(afterA).toEqual(beforeA);
  });
});
