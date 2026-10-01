import { dateOf, dayNumber, isDay, weekStart } from "./calendar";
import { counts, hoursOf, mediaTypeOf, type Award } from "./gamification";
import type { LibraryEntry, LibraryEvent, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

// One chart color each (GOALS §6.6); movies and TV share "screen".
export const FAMILIES = ["screen", "anime", "manga", "book", "game"] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Record<Family, string> = {
  screen: "Movies & TV",
  anime: "Anime",
  manga: "Manga",
  book: "Books",
  game: "Games",
};

export type WeekPoint = { week: string; total: number } & Record<Family, number>;

export interface FamilyStats {
  items: number;
  completed: number;
  hours: number;
}

export interface Backlog {
  hours: number;
  items: number;
  unknown: number;
}

export const PACE_DAYS = 30;

export const familyOf = (type: MediaType): Family =>
  type === "movie" || type === "tv" ? "screen" : type;

const familyOfKey = (key: string): Family | null => {
  const type = mediaTypeOf(key);
  return type ? familyOf(type) : null;
};

export { weekStart };

const emptyWeek = (week: string): WeekPoint => ({
  week,
  total: 0,
  screen: 0,
  anime: 0,
  manga: 0,
  book: 0,
  game: 0,
});

// Every week from the first award up to today, empty weeks included, so the chart has no gaps.
export function xpByWeek(list: Award[], today: string): WeekPoint[] {
  const dated = list.filter((a) => isDay(a.local_date));
  if (dated.length === 0) return [];
  const byWeek = new Map<string, WeekPoint>();
  const first = dayNumber(
    weekStart(dated.reduce((m, a) => (a.local_date < m ? a.local_date : m), today)),
  );
  for (let d = first; d <= dayNumber(weekStart(today)); d += 7)
    byWeek.set(dateOf(d), emptyWeek(dateOf(d)));
  for (const a of dated) {
    const point = byWeek.get(weekStart(a.local_date));
    const family = familyOfKey(a.media_key);
    if (!point || !family) continue;
    point[family] += a.xp;
    point.total += a.xp;
  }
  return [...byWeek.values()];
}

// A zero week before the first one: XP really was 0 then, and one week alone draws no line.
export function withBaseline(weeks: WeekPoint[]): WeekPoint[] {
  if (weeks.length === 0) return [];
  return [emptyWeek(dateOf(dayNumber(weeks[0].week) - 7)), ...weeks];
}

export function cumulative(weeks: WeekPoint[]): WeekPoint[] {
  const running = emptyWeek("");
  return weeks.map((w) => {
    running.total += w.total;
    for (const f of FAMILIES) running[f] += w[f];
    return { ...running, week: w.week };
  });
}

// Meaningful events per `local_date`, each id once.
export function activityByDay(events: LibraryEvent[]): Map<string, number> {
  const seen = new Set<string>();
  const out = new Map<string, number>();
  for (const e of events) {
    if (seen.has(e.id) || !counts(e)) continue;
    seen.add(e.id);
    out.set(e.local_date, (out.get(e.local_date) ?? 0) + 1);
  }
  return out;
}

export function statusCounts(entries: LibraryEntry[]): Record<LibraryStatus, number> {
  const out: Record<LibraryStatus, number> = {
    planning: 0,
    in_progress: 0,
    completed: 0,
    dropped: 0,
  };
  for (const e of entries) out[e.user.status]++;
  return out;
}

const totalHours = (e: LibraryEntry): number | null =>
  hoursOf(e.snapshot.media_type, e.user.length);

// Units done × time per unit; the whole length once completed; 0 when the length is unknown.
export function hoursDone(e: LibraryEntry): number {
  const total = totalHours(e);
  if (total === null) return 0;
  if (e.user.status === "completed") return total;
  const { media_type: type } = e.snapshot;
  const { length, progress } = e.user;
  const units =
    type === "movie"
      ? 1
      : type === "game"
        ? total
        : type === "manga"
          ? (length.chapters ?? 0)
          : (length.episodes ?? 0);
  return units > 0 ? Math.min(total, (progress / units) * total) : 0;
}

export function familyBreakdown(entries: LibraryEntry[]): Record<Family, FamilyStats> {
  const out = Object.fromEntries(
    FAMILIES.map((f) => [f, { items: 0, completed: 0, hours: 0 }]),
  ) as Record<Family, FamilyStats>;
  for (const e of entries) {
    const stats = out[familyOf(e.snapshot.media_type)];
    stats.items++;
    if (e.user.status === "completed") stats.completed++;
    stats.hours += hoursDone(e);
  }
  return out;
}

// Hours still to go on planned and in-progress items; items with no known length are only counted.
export function backlog(entries: LibraryEntry[]): Backlog {
  const out: Backlog = { hours: 0, items: 0, unknown: 0 };
  for (const e of entries) {
    if (e.user.status !== "planning" && e.user.status !== "in_progress") continue;
    const total = totalHours(e);
    if (total === null) {
      out.unknown++;
      continue;
    }
    out.items++;
    out.hours += total - hoursDone(e);
  }
  return out;
}

// Average XP per day over the last `PACE_DAYS` days, today included.
export function pace(list: Award[], today: string): number {
  const now = dayNumber(today);
  const inWindow = (a: Award) => {
    const day = dayNumber(a.local_date);
    return day > now - PACE_DAYS && day <= now;
  };
  const xp = list.filter(inWindow).reduce((s, a) => s + a.xp, 0);
  return xp / PACE_DAYS;
}

// Null when there is no recent pace: "never" is not a date.
export function nextLevelEta(xpLeft: number, xpPerDay: number): number | null {
  if (xpLeft <= 0) return 0;
  if (xpPerDay <= 0) return null;
  return Math.ceil(xpLeft / xpPerDay);
}

export const RANGES = [
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "all", label: "All", days: null },
] as const;

export type RangeValue = (typeof RANGES)[number]["value"];

// Weeks that overlap the last `days` days; null keeps everything.
export function inRange(weeks: WeekPoint[], days: number | null, today: string): WeekPoint[] {
  if (days === null) return weeks;
  const from = dayNumber(today) - days;
  return weeks.filter((w) => dayNumber(w.week) + 6 > from);
}

export interface HeatDay {
  date: string;
  count: number;
  future: boolean;
}

// `count` whole weeks, Monday first, the last one holding today.
export function heatmapWeeks(
  activity: Map<string, number>,
  today: string,
  count: number,
): HeatDay[][] {
  const last = dayNumber(weekStart(today));
  const now = dayNumber(today);
  return Array.from({ length: count }, (_, w) => {
    const monday = last - (count - 1 - w) * 7;
    return Array.from({ length: 7 }, (_, d) => {
      const date = dateOf(monday + d);
      return { date, count: activity.get(date) ?? 0, future: monday + d > now };
    });
  });
}

export interface ForecastPoint {
  week: string;
  actual: number | null;
  projected: number | null;
}

// The running XP total, then `ahead` more weeks at `xpPerDay`; the two lines meet at the last real week.
export function forecastLine(weeks: WeekPoint[], xpPerDay: number, ahead: number): ForecastPoint[] {
  if (weeks.length === 0) return [];
  const running = cumulative(withBaseline(weeks));
  const out: ForecastPoint[] = running.map((w) => ({
    week: w.week,
    actual: w.total,
    projected: null,
  }));
  const lastPoint = out[out.length - 1];
  lastPoint.projected = lastPoint.actual;
  const start = dayNumber(lastPoint.week);
  for (let i = 1; i <= ahead; i++) {
    out.push({
      week: dateOf(start + i * 7),
      actual: null,
      projected: Math.round((lastPoint.actual ?? 0) + xpPerDay * 7 * i),
    });
  }
  return out;
}
