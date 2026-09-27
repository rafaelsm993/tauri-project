import type { Length, LibraryEntry, LibraryEvent } from "$lib/types/library";
import type { MediaKey, MediaType } from "$lib/types/media";

// Placeholders until the playtest (GOALS §11); retuning is a code change, never a migration.
export const XP = { add: 5, rating: 10, completion: 50 } as const;

export type LengthBucket = "short" | "medium" | "long" | "epic";

export const LENGTH_BONUS: Record<LengthBucket, number> = {
  short: 0,
  medium: 15,
  long: 40,
  epic: 80,
};

// Lower edge in hours of each bucket above "short".
const BUCKET_FLOORS: [LengthBucket, number][] = [
  ["epic", 50],
  ["long", 10],
  ["medium", 2],
];

export const TITLES = [
  { level: 1, name: "Newcomer" },
  { level: 3, name: "Curious Mind" },
  { level: 5, name: "Regular" },
  { level: 8, name: "Enthusiast" },
  { level: 12, name: "Connoisseur" },
  { level: 16, name: "Devotee" },
  { level: 20, name: "Archivist" },
  { level: 25, name: "Curator" },
  { level: 30, name: "Loremaster" },
  { level: 40, name: "Chronicler" },
  { level: 50, name: "Aevum Eternal" },
] as const;

export type AwardReason = "add" | "rating" | "completion";

export interface Award {
  event_id: string;
  media_key: MediaKey;
  local_date: string;
  reason: AwardReason;
  xp: number;
}

export interface LevelInfo {
  level: number;
  xp: number;
  into: number;
  needed: number;
  fraction: number;
}

export interface Title {
  name: string;
  next: { name: string; level: number } | null;
}

export interface Streaks {
  current: number;
  longest: number;
}

// Events that show the user did something; removing does not count.
export const ACTIVE_KINDS: ReadonlySet<string> = new Set(["library_add", "library_update"]);

export const isDay = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date);

// An action worth counting: add or update, on a real calendar day.
export const counts = (e: LibraryEvent): boolean => ACTIVE_KINDS.has(e.kind) && isDay(e.local_date);

interface ItemState {
  added: boolean;
  rated: boolean;
  completed: boolean;
  length: Length | null;
}

type Patch = { status?: unknown; rating?: unknown; length?: unknown };

const asPatch = (payload: unknown): Patch =>
  payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Patch) : {};

export function mediaTypeOf(key: MediaKey): MediaType | null {
  const type = key.split(":")[1];
  const known: MediaType[] = ["movie", "tv", "anime", "manga", "book", "game"];
  return known.includes(type as MediaType) ? (type as MediaType) : null;
}

const known = (value: number | null | undefined): number | null =>
  value && value > 0 ? value : null;

// Books have no reading pace yet, so their length in hours is unknown.
export function hoursOf(type: MediaType | null, length: Length | null): number | null {
  if (!length || !type) return null;
  const minutes = (count: number | null, each: number | null) => {
    const [c, m] = [known(count), known(each)];
    return c && m ? (c * m) / 60 : null;
  };
  switch (type) {
    case "movie":
      return minutes(1, length.runtime_minutes);
    case "tv":
    case "anime":
      return minutes(length.episodes, length.episode_minutes);
    case "manga":
      return minutes(length.chapters, length.chapter_minutes);
    case "game":
      return known(length.hours);
    case "book":
      return null;
  }
}

export function lengthBucket(hours: number | null): LengthBucket | null {
  if (hours === null) return null;
  return BUCKET_FLOORS.find(([, floor]) => hours >= floor)?.[0] ?? "short";
}

function completionXp(key: MediaKey, length: Length | null): number {
  const bucket = lengthBucket(hoursOf(mediaTypeOf(key), length));
  return XP.completion + (bucket ? LENGTH_BONUS[bucket] : 0);
}

// The saved length of each item, for completions the log never sized.
export const savedLengths = (entries: LibraryEntry[]): ReadonlyMap<MediaKey, Length> =>
  new Map(entries.map((e) => [e.key, e.user.length]));

// Replays the log once; each item pays for its first add, rating and completion only.
// `lengths` (the saved entries) sizes a completion the log never carried a length for.
export function awards(
  events: LibraryEvent[],
  lengths: ReadonlyMap<MediaKey, Length> = new Map(),
): Award[] {
  const seen = new Set<string>();
  const items = new Map<MediaKey, ItemState>();
  const out: Award[] = [];
  for (const e of events) {
    if (seen.has(e.id) || !counts(e)) continue;
    seen.add(e.id);
    const item = items.get(e.media_key) ?? {
      added: false,
      rated: false,
      completed: false,
      length: null,
    };
    items.set(e.media_key, item);
    const pay = (reason: AwardReason, xp: number) =>
      out.push({ event_id: e.id, media_key: e.media_key, local_date: e.local_date, reason, xp });
    const patch = asPatch(e.payload);
    if (patch.length && typeof patch.length === "object") item.length = patch.length as Length;
    if (e.kind === "library_add" && !item.added) {
      item.added = true;
      pay("add", XP.add);
    }
    if (typeof patch.rating === "number" && !item.rated) {
      item.rated = true;
      pay("rating", XP.rating);
    }
    if (patch.status === "completed" && !item.completed) {
      item.completed = true;
      pay("completion", completionXp(e.media_key, item.length ?? lengths.get(e.media_key) ?? null));
    }
  }
  return out;
}

export const totalXp = (list: Award[]): number => list.reduce((sum, a) => sum + a.xp, 0);

export const xpForLevel = (level: number): number =>
  level <= 1 ? 0 : Math.round(50 * level ** 1.5);

export function levelOf(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const needed = xpForLevel(level + 1) - floor;
  const into = xp - floor;
  return { level, xp, into, needed, fraction: into / needed };
}

// The day each level was first reached, for level-up moments.
export function levelUps(list: Award[]): { level: number; local_date: string }[] {
  const out: { level: number; local_date: string }[] = [];
  let xp = 0;
  let level = 1;
  for (const a of list) {
    xp += a.xp;
    const now = levelOf(xp).level;
    for (let l = level + 1; l <= now; l++) out.push({ level: l, local_date: a.local_date });
    level = now;
  }
  return out;
}

export function titleFor(level: number): Title {
  const index = Math.max(0, TITLES.filter((t) => t.level <= level).length - 1);
  const current = TITLES[index];
  const next = TITLES[index + 1];
  return { name: current.name, next: next ? { name: next.name, level: next.level } : null };
}

// Sorted, distinct `YYYY-MM-DD` days with activity.
export function activeDays(events: LibraryEvent[]): string[] {
  return [...new Set(events.filter(counts).map((e) => e.local_date))].sort();
}

const DAY_MS = 86_400_000;

export const dayNumber = (date: string): number =>
  Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

// A streak survives until a full day passes with nothing done; days after today are ignored.
export function streaks(days: string[], today: string): Streaks {
  const now = dayNumber(today);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const n of days.map(dayNumber).filter((n) => n <= now)) {
    run = prev !== null && n - prev === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = n;
  }
  const alive = prev !== null && now - prev <= 1;
  return { current: alive ? run : 0, longest };
}
