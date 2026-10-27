import { describe, expect, it } from "vitest";
import { treeBranches } from "./progressionTree";
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

import { journeyNodes, journeyEdges } from "./progressionTree";
import { COMPLETION_TYPES } from "./completionAchievements";
import { UNLOCKS } from "./unlocks";
import { TITLES } from "./gamification";

const completed = (type: MediaType) =>
  Array.from({ length: 50 }, (_, i) => {
    const saved = entry(i + 1, type);
    saved.user.status = "completed";
    return saved;
  });

it("journey: presents every existing reward exactly once", () => {
  const nodes = COMPLETION_TYPES.flatMap((type) => journeyNodes(completed(type), 50, type));
  expect(nodes).toHaveLength(50);
  expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
  expect(nodes.filter((node) => node.kind === "art")).toHaveLength(30);
  expect(nodes.filter((node) => node.kind !== "art")).toHaveLength(UNLOCKS.length + TITLES.length);
  for (const [type, count] of [
    ["movie", 9],
    ["tv", 9],
    ["anime", 8],
    ["manga", 8],
    ["book", 8],
    ["game", 8],
  ] as const)
    expect(journeyNodes([], 1, type)).toHaveLength(count);
});

it("journey: keeps global rewards level-only despite an empty home medium", () => {
  const nodes = journeyNodes([], 2, "movie");
  expect(nodes.find((node) => node.rewardId === "bubbles")).toMatchObject({
    available: true,
    level: 2,
  });
  expect(nodes.find((node) => node.rewardId === "ember")).toMatchObject({
    available: false,
    level: 3,
  });
  expect(nodes.filter((node) => node.kind === "art").every((node) => !node.available)).toBe(true);
  expect(journeyNodes([], 1, "movie").find((node) => node.rewardId === "bubbles")?.available).toBe(
    false,
  );
});

it.each(COMPLETION_TYPES)("journey: %s retains art completion and level gates", (type) => {
  for (const level of [1, 2, 3, 4, 5, 7, 8, 11, 12, 50, 200, 1]) {
    const art = journeyNodes(completed(type), level, type).filter((node) => node.kind === "art");
    expect(art.map((node) => node.available)).toEqual(
      [1, 3, 5, 8, 12].map((gate) => level >= gate),
    );
    expect(
      journeyNodes([], level, type)
        .filter((node) => node.kind === "art")
        .every((node) => !node.available),
    ).toBe(true);
  }
});

it.each(COMPLETION_TYPES)("journey: %s graph reaches every seal from the root", (type) => {
  const nodes = journeyNodes(completed(type), 50, type);
  const edges = journeyEdges(nodes);
  const reached = new Set(["root"]);
  for (let pass = 0; pass <= nodes.length; pass++)
    for (const edge of edges) {
      if (reached.has(edge.from)) reached.add(edge.to);
      if (reached.has(edge.to)) reached.add(edge.from);
    }
  expect([...reached].sort()).toEqual(["root", ...nodes.map((node) => node.id)].sort());
  expect(edges.every((edge) => edge.available)).toBe(true);
  for (const edge of edges) {
    const start =
      edge.from === "root" ? { x: 50, y: 96 } : nodes.find((node) => node.id === edge.from)!;
    const end = nodes.find((node) => node.id === edge.to)!;
    expect(edge.d.startsWith(`M${start.x} ${start.y}H`)).toBe(true);
    expect(edge.d.endsWith(`H${end.x}`)).toBe(true);
    if (start.y !== end.y) expect(edge.d).toContain(`V${end.y}H`);
  }
  const locked = nodes.map((node) => ({ ...node, available: false }));
  const dim = journeyEdges(locked);
  expect(dim.map((edge) => edge.d)).toEqual(edges.map((edge) => edge.d));
  expect(dim.every((edge) => !edge.available)).toBe(true);
  const partial = nodes.map((node, index) => ({ ...node, available: index % 2 === 0 }));
  for (const edge of journeyEdges(partial)) {
    const from = edge.from === "root" || partial.find((node) => node.id === edge.from)!.available;
    const to = partial.find((node) => node.id === edge.to)!.available;
    expect(edge.available).toBe(from && to);
  }
});
