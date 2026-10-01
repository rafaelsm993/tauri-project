import { addDays, dayNumber, weekStart } from "./calendar";
import { familyOf, type Family } from "./dashboard";
import { DEFAULT_PAGES_PER_HOUR, estimate } from "./estimate";
import type { LengthField } from "./length";
import { schedule, type Schedule, type Session, type Weekday } from "./schedule";
import type { LibraryEntry, Plan } from "$lib/types/library";

export type PlanResult = Schedule | { kind: "needs"; missing: LengthField[] } | { kind: "dropped" };

export interface PlannedItem {
  entry: LibraryEntry;
  family: Family;
  sessions: Session[];
  finish: string;
}

export interface NeedsItem {
  entry: LibraryEntry;
  missing: LengthField[];
}

export interface PlannerData {
  planned: PlannedItem[];
  needs: NeedsItem[];
}

export interface Block {
  id: string;
  key: string;
  title: string;
  family: Family;
  minutes: number;
}

export interface Day {
  date: string;
  blocks: Block[];
  total: number;
}

export interface FinishShift {
  dir: "earlier" | "same" | "later";
  days: number;
}

// What is left of an item under a plan, re-planned from `today` or the plan's later start.
export function planFor(
  entry: LibraryEntry,
  plan: Plan,
  today: string,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): PlanResult {
  const e = estimate(entry, pagesPerHour);
  if (e.kind !== "plannable") return e;
  const conditions = { days: plan.days as Weekday[], maxSessionMinutes: plan.max_session_minutes };
  return schedule(e.remainingMinutes, conditions, plan.since > today ? plan.since : today);
}

// Every planned item that is still in play, soonest finish first; items missing length apart.
export function plannerData(
  entries: LibraryEntry[],
  today: string,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): PlannerData {
  const planned: PlannedItem[] = [];
  const needs: NeedsItem[] = [];
  for (const entry of entries) {
    const { plan, status } = entry.user;
    if (!plan || status === "completed") continue;
    const result = planFor(entry, plan, today, pagesPerHour);
    if (result.kind === "needs") needs.push({ entry, missing: result.missing });
    if (result.kind !== "planned") continue;
    const family = familyOf(entry.snapshot.media_type);
    planned.push({ entry, family, sessions: result.sessions, finish: result.finish });
  }
  planned.sort(
    (a, b) =>
      a.finish.localeCompare(b.finish) ||
      a.entry.snapshot.title.localeCompare(b.entry.snapshot.title),
  );
  return { planned, needs };
}

// The seven days (Monday first) of the week `weekOf` falls in, with each item's session blocks.
export function weekView(items: PlannedItem[], weekOf: string): Day[] {
  const monday = weekStart(weekOf);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const blocks = items.flatMap(({ entry, family, sessions }) =>
      sessions
        .filter((s) => s.date === date)
        .map((s) => ({
          id: `${entry.key}@${date}`,
          key: entry.key,
          title: entry.snapshot.title,
          family,
          minutes: s.minutes,
        })),
    );
    return { date, blocks, total: blocks.reduce((sum, b) => sum + b.minutes, 0) };
  });
}

// How the finish line moved; never phrased as being behind.
export function finishShift(before: string, after: string): FinishShift {
  const delta = dayNumber(after) - dayNumber(before);
  if (delta === 0) return { dir: "same", days: 0 };
  return { dir: delta > 0 ? "later" : "earlier", days: Math.abs(delta) };
}
