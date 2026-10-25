import { describe, expect, it } from "vitest";
import { levelWindow, treeBranches, treeLevels } from "./progressionTree";
import { emptyLength } from "./length";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaType, ProviderId } from "$lib/types/media";

function entry(id: number, type: MediaType = "manga", genres?: string[]): LibraryEntry {
  const providers: Record<MediaType, ProviderId> = {
    movie: "tmdb",
    tv: "tmdb",
    anime: "anilist",
    manga: "anilist",
    book: "itunes",
    game: "rawg",
  };
  const provider = providers[type];
  const key = `${provider}:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider,
      media_type: type,
      title: `Story ${id}`,
      poster_path: null,
      poster_file: null,
      year: null,
      ...(genres === undefined ? {} : { genres }),
    },
    user: {
      status: "planning",
      progress: 0,
      rating: null,
      review: null,
      length: emptyLength(),
      plan: null,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

describe("treeBranches", () => {
  it("joins matching type and genre entries into one branch", () => {
    const first = entry(1, "manga", ["Action"]);
    const second = entry(2, "manga", ["Action"]);
    expect(treeBranches([second, first])).toEqual([
      {
        type: "manga",
        count: 2,
        genres: [{ id: "manga:action", label: "Action", members: [first, second] }],
      },
    ]);
  });

  it("keeps the same genre in different media paths separate", () => {
    const branches = treeBranches([entry(1, "manga", ["Action"]), entry(2, "anime", ["Action"])]);
    expect(branches.map((b) => b.type)).toEqual(["anime", "manga"]);
    expect(branches.map((b) => b.genres[0].id)).toEqual(["anime:action", "manga:action"]);
  });

  it("keeps all six media types separate and in catalogue order", () => {
    const types: MediaType[] = ["game", "book", "manga", "anime", "tv", "movie"];
    const branches = treeBranches(types.map((type, i) => entry(i, type, ["Drama"])));
    expect(branches.map((b) => b.type)).toEqual(["movie", "tv", "anime", "manga", "book", "game"]);
    expect(branches.every((b) => b.count === 1 && b.genres[0].members.length === 1)).toBe(true);
  });

  it("counts one saved entry even when it belongs to multiple genres", () => {
    const saved = entry(1, "manga", ["Comedy", "Action"]);
    const [branch] = treeBranches([saved]);
    expect(branch.count).toBe(1);
    expect(branch.genres.map((g) => g.label)).toEqual(["Action", "Comedy"]);
    expect(branch.genres.map((g) => g.members)).toEqual([[saved], [saved]]);
  });

  it("normalizes Unicode, case and whitespace without repeating a membership", () => {
    const first = entry(1, "manga", [" Action ", "ACTION", "\uFF21ction", " Science   Fiction "]);
    const second = entry(2, "manga", ["action", "science\u00a0fiction"]);
    const [branch] = treeBranches([second, first]);
    expect(branch.genres.map((g) => [g.id, g.label, g.members.map((e) => e.key)])).toEqual([
      ["manga:action", "Action", [first.key, second.key]],
      ["manga:science%20fiction", "Science Fiction", [first.key, second.key]],
    ]);
  });

  it.each([undefined, [], ["", " ", "\t"]])(
    "uses Unclassified for absent or blank genres: %j",
    (genres) => {
      const saved = entry(1, "book", genres);
      expect(treeBranches([saved])[0].genres).toEqual([
        { id: "book:unclassified", label: "Unclassified", members: [saved] },
      ]);
    },
  );

  it("deduplicates a saved key before computing counts or memberships", () => {
    const saved = entry(1, "manga", ["Action", "Comedy"]);
    const [branch] = treeBranches([saved, structuredClone(saved)]);
    expect(branch.count).toBe(1);
    expect(branch.genres.every((g) => g.members.length === 1)).toBe(true);
  });

  it("is stable when input order changes, including the retained display label", () => {
    const entries = [
      entry(3, "book", ["History"]),
      entry(2, "manga", ["action"]),
      entry(1, "manga", ["Action"]),
    ];
    expect(treeBranches([...entries].reverse())).toEqual(treeBranches(entries));
    expect(treeBranches(entries)[0].genres[0].label).toBe("Action");
  });

  it("does not mutate the input array, snapshots or genre lists", () => {
    const entries = [entry(2, "manga", ["Comedy", "Action"]), entry(1, "manga", [" action "])];
    const before = structuredClone(entries);
    for (const saved of entries) {
      Object.freeze(saved.snapshot.genres);
      Object.freeze(saved.snapshot);
      Object.freeze(saved);
    }
    Object.freeze(entries);
    treeBranches(entries);
    expect(entries).toEqual(before);
  });

  it("does not fabricate member groups for an empty library", () => {
    expect(treeBranches([])).toEqual([]);
  });
});

describe("treeLevels", () => {
  it("keeps the root earned and future catalogue levels discoverable", () => {
    expect(treeLevels(1)).toEqual({ earned: 1, last: 50 });
  });

  it("uses only the current level after a level drop", () => {
    expect(treeLevels(12).earned).toBe(12);
    expect(treeLevels(8).earned).toBe(8);
    expect(levelWindow(8, 1).rows.find((r) => r.level === 12)?.unlocked).toBe(false);
  });

  it("keeps a future level after the user exceeds the catalogue", () => {
    expect(treeLevels(200)).toEqual({ earned: 200, last: 201 });
  });
});

describe("levelWindow", () => {
  it("renders each level from top to root without skipping empty reward tiers", () => {
    const window = levelWindow(8, 0);
    expect(window.rows.map((r) => r.level)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(window.rows.filter((r) => r.unlocked).map((r) => r.level)).toEqual([
      8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    expect(window.rows.filter((r) => r.current).map((r) => r.level)).toEqual([8]);
    expect(window.rows.find((r) => r.level === 4)).toMatchObject({ rewards: [], titles: [] });
  });

  it("includes both level-eight rewards and the existing title", () => {
    const tier = levelWindow(8, 0).rows.find((r) => r.level === 8)!;
    expect(tier.rewards.map((r) => r.id)).toEqual(["sway", "dusk"]);
    expect(tier.titles).toEqual([{ level: 8, name: "Enthusiast" }]);
  });

  it("exposes locked future titles and rewards without earning them", () => {
    const tier = levelWindow(8, 1).rows.find((r) => r.level === 12)!;
    expect(tier.unlocked).toBe(false);
    expect(tier.current).toBe(false);
    expect(tier.rewards.map((r) => r.id)).toEqual(["aurora"]);
    expect(tier.titles).toEqual([{ level: 12, name: "Connoisseur" }]);
  });

  it("bounds level 200 to ten rows and exposes its next locked row", () => {
    const window = levelWindow(200, 19);
    expect(window).toMatchObject({
      earned: 200,
      last: 201,
      pages: 21,
      page: 19,
      start: 191,
      end: 200,
    });
    expect(window.rows).toHaveLength(10);
    expect(window.rows[0]).toMatchObject({ level: 200, current: true, unlocked: true });
    expect(levelWindow(200, 20).rows).toEqual([
      { level: 201, unlocked: false, current: false, rewards: [], titles: [] },
    ]);
  });

  it("clamps out-of-range pages and floors fractional page indices", () => {
    expect(levelWindow(8, -1).page).toBe(0);
    expect(levelWindow(8, 99)).toMatchObject({ page: 4, start: 41, end: 50 });
    expect(levelWindow(8, 1.9)).toMatchObject({ page: 1, start: 11, end: 20 });
  });

  it("covers every catalogue level once across pages", () => {
    const rows = Array.from(
      { length: levelWindow(1, 0).pages },
      (_, page) => levelWindow(1, page).rows,
    ).flat();
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((r) => r.level)).size).toBe(50);
  });

  it("supports a smaller explicit page size without changing level eligibility", () => {
    const window = levelWindow(8, 2, 3);
    expect(window).toMatchObject({ page: 2, pages: 17, start: 7, end: 9 });
    expect(window.rows.map((r) => [r.level, r.unlocked])).toEqual([
      [9, false],
      [8, true],
      [7, true],
    ]);
  });
});
