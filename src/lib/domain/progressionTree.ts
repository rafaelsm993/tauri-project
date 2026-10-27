import type { LibraryEntry } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";
import { TITLES } from "./gamification";
import { UNLOCKS, type UnlockId, type UnlockKind } from "./unlocks";
import { completionAchievements } from "./completionAchievements";

const TYPES: MediaType[] = ["movie", "tv", "anime", "manga", "book", "game"];
const clean = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ");
const keyOf = (s: string) => clean(s).toLowerCase();
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface GenreBranch {
  id: string;
  label: string;
  members: LibraryEntry[];
}
export interface TypeBranch {
  type: MediaType;
  count: number;
  genres: GenreBranch[];
}

export function treeBranches(input: LibraryEntry[]): TypeBranch[] {
  const entries = [...new Map(input.map((e) => [e.key, e])).values()].sort((a, b) =>
    compare(a.key, b.key),
  );
  return TYPES.flatMap((type) => {
    const typed = entries.filter((e) => e.snapshot.media_type === type);
    if (!typed.length) return [];
    const groups = new Map<string, GenreBranch>();
    for (const e of typed) {
      const genres = new Map<string, string>();
      for (const raw of e.snapshot.genres ?? []) {
        const label = clean(raw);
        if (label && !genres.has(keyOf(label))) genres.set(keyOf(label), label);
      }
      if (!genres.size) genres.set("unclassified", "Unclassified");
      for (const [key, label] of genres) {
        const branch = groups.get(key) ?? {
          id: `${type}:${encodeURIComponent(key)}`,
          label,
          members: [],
        };
        branch.members.push(e);
        groups.set(key, branch);
      }
    }
    return [
      {
        type,
        count: typed.length,
        genres: [...groups.values()].sort((a, b) => compare(a.id, b.id)),
      },
    ];
  });
}

export interface TreeMapNode {
  id: string;
  art?: string;
  label: string;
  title: string;
  caption: string;
  detail?: string;
  available?: boolean;
  x: number;
  y: number;
  kind?: UnlockKind | "title" | "art";
  rewardId?: string;
}

export interface JourneyNode extends TreeMapNode {
  kind: UnlockKind | "title" | "art";
  rewardId: string;
  level: number;
  available: boolean;
}

const REWARD_HOME: Record<UnlockId, MediaType> = {
  bubbles: "movie",
  ember: "movie",
  embers: "tv",
  sway: "tv",
  aurora: "anime",
  dusk: "manga",
  sunrise: "book",
  ocean: "game",
  midnight: "game",
};
const TITLE_HOME: Record<(typeof TITLES)[number]["name"], MediaType> = {
  Newcomer: "movie",
  "Curious Mind": "movie",
  Regular: "tv",
  Enthusiast: "tv",
  Connoisseur: "anime",
  Devotee: "anime",
  Archivist: "manga",
  Curator: "manga",
  Loremaster: "book",
  Chronicler: "book",
  "Aevum Eternal": "game",
};
const JOURNEY_POSITIONS = [
  [50, 80],
  [22, 64],
  [78, 64],
  [22, 46],
  [50, 46],
  [78, 46],
  [22, 28],
  [78, 28],
  [50, 10],
] as const;

export function journeyNodes(
  entries: LibraryEntry[],
  level: number,
  type: MediaType,
): JourneyNode[] {
  const nodes: Omit<JourneyNode, "x" | "y">[] = completionAchievements(entries, level)
    .filter((reward) => reward.type === type)
    .map((reward) => ({
      id: reward.id,
      art: reward.id,
      kind: "art",
      rewardId: reward.id,
      label: `Preview ${reward.name} tier ${reward.tier}`,
      title: `${reward.required} done`,
      caption: `Level ${reward.level}`,
      detail: `${reward.count} / ${reward.required} completed · Tier ${reward.tier}`,
      level: reward.level,
      available: reward.unlocked,
    }));
  for (const reward of UNLOCKS.filter((reward) => REWARD_HOME[reward.id] === type))
    nodes.push({
      id: `${reward.kind}:${reward.id}`,
      kind: reward.kind,
      rewardId: reward.id,
      label: `Preview ${reward.label}`,
      title: reward.label,
      caption: `Level ${reward.level}`,
      detail: reward.blurb,
      level: reward.level,
      available: level >= reward.level,
    });
  for (const title of TITLES.filter((title) => TITLE_HOME[title.name] === type))
    nodes.push({
      id: `title:${encodeURIComponent(title.name)}`,
      kind: "title",
      rewardId: title.name,
      label: `Preview title ${title.name}`,
      title: title.name,
      caption: `Level ${title.level}`,
      detail: "Profile title",
      level: title.level,
      available: level >= title.level,
    });
  nodes.sort((a, b) => a.level - b.level || compare(a.id, b.id));
  const positions =
    nodes.length === 8 ? JOURNEY_POSITIONS.filter((_, index) => index !== 4) : JOURNEY_POSITIONS;
  if (nodes.length !== 8 && nodes.length !== 9)
    throw new Error("Journey layout requires 8 or 9 rewards");
  return nodes.map((node, index) => ({ ...node, x: positions[index][0], y: positions[index][1] }));
}

export interface JourneyEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  available: boolean;
}

export function journeyEdges(nodes: readonly TreeMapNode[]): JourneyEdge[] {
  const rows = [...new Set(nodes.map((node) => node.y))]
    .sort((a, b) => b - a)
    .map((y) => nodes.filter((node) => node.y === y).sort((a, b) => a.x - b.x));
  const edges: JourneyEdge[] = [];
  const connect = (from: TreeMapNode, to: TreeMapNode) => {
    const gutter =
      from.x === to.x ? (from.x === 22 ? 8 : from.x === 78 ? 92 : 64) : (from.x + to.x) / 2;
    edges.push({
      id: `${from.id}->${to.id}`,
      from: from.id,
      to: to.id,
      d:
        from.y === to.y
          ? `M${from.x} ${from.y}H${to.x}`
          : `M${from.x} ${from.y}H${gutter}V${to.y}H${to.x}`,
      available: from.available !== false && to.available !== false,
    });
  };
  const root: TreeMapNode = {
    id: "root",
    label: "",
    title: "",
    caption: "",
    x: 50,
    y: 96,
    available: true,
  };
  for (const node of rows[0] ?? []) connect(root, node);
  for (const [index, row] of rows.entries()) {
    for (let i = 1; i < row.length; i++) connect(row[i - 1], row[i]);
    const above = rows[index + 1];
    if (!above) continue;
    for (const node of row) {
      const nearest = [...above].sort(
        (a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x) || a.x - b.x,
      )[0];
      connect(node, nearest);
    }
  }
  return edges;
}
