import type { LibraryEntry } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";
import { TITLES } from "./gamification";
import { UNLOCKS } from "./unlocks";

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

export function treeLevels(current: number) {
  const earned = Math.max(1, Math.floor(current));
  const last = Math.max(earned + 1, ...UNLOCKS.map((u) => u.level), ...TITLES.map((t) => t.level));
  return { earned, last };
}

export function levelWindow(current: number, page: number, size = 10) {
  const { earned, last } = treeLevels(current);
  const pages = Math.ceil(last / size);
  const selected = Math.max(0, Math.min(pages - 1, Math.floor(page)));
  const start = selected * size + 1;
  const end = Math.min(last, start + size - 1);
  const rows = Array.from({ length: end - start + 1 }, (_, i) => {
    const level = start + i;
    return {
      level,
      unlocked: level <= earned,
      current: level === current,
      rewards: UNLOCKS.filter((u) => u.level === level),
      titles: TITLES.filter((t) => t.level === level),
    };
  }).reverse();
  return { earned, last, page: selected, pages, start, end, rows };
}
