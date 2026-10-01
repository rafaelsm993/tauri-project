import { addDays, weekday } from "./calendar";
import type { Family } from "./dashboard";
import { DEFAULT_PAGES_PER_HOUR } from "./estimate";
import { plannerData, type PlannedItem } from "./planner";
import { formatDay, formatMinutes } from "$lib/utils/format";
import type { LibraryEntry, LibraryEvent, Plan } from "$lib/types/library";

export interface DueSession {
  entry: LibraryEntry;
  family: Family;
  minutes: number;
  finish: string;
}

export interface Replanned {
  count: number;
  title: string;
  finish: string;
}

export interface TodayPlan {
  due: DueSession[];
  replanned: Replanned | null;
}

export interface ToastMemory {
  toastedAt: ReadonlyMap<string, number>;
  snoozedUntil: number;
}

export const SNOOZE_MS = 3 * 60 * 60 * 1000;
// How far back earlier plan days are counted for the re-planned note.
export const LOOKBACK_DAYS = 7;

const patchOf = (payload: unknown): Record<string, unknown> =>
  payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

// Progress or a status change that day, or a plan moved past it (Done / Next session).
export function didSession(events: LibraryEvent[], key: string, day: string): boolean {
  return events.some((e) => {
    if (e.media_key !== key || e.local_date !== day) return false;
    const patch = patchOf(e.payload);
    if (e.kind === "library_update") return "progress" in patch || "status" in patch;
    return e.kind === "library_plan" && typeof patch.since === "string" && patch.since > day;
  });
}

function earlierPlanDays(plan: Plan, today: string): string[] {
  const from =
    plan.since > addDays(today, -LOOKBACK_DAYS) ? plan.since : addDays(today, -LOOKBACK_DAYS);
  const days: string[] = [];
  for (let d = from; d < today; d = addDays(d, 1)) if (plan.days.includes(weekday(d))) days.push(d);
  return days;
}

function replannedOf(
  items: PlannedItem[],
  events: LibraryEvent[],
  today: string,
): Replanned | null {
  let count = 0;
  let top: { item: PlannedItem; count: number } | null = null;
  for (const item of items) {
    const { key, user } = item.entry;
    if (!user.plan) continue;
    const skipped = earlierPlanDays(user.plan, today).filter((d) => !didSession(events, key, d));
    count += skipped.length;
    if (skipped.length > (top?.count ?? 0)) top = { item, count: skipped.length };
  }
  if (!top) return null;
  return { count, title: top.item.entry.snapshot.title, finish: top.item.finish };
}

// Today's planned sessions not done yet, and how many earlier ones moved into the plan.
export function todaySessions(
  entries: LibraryEntry[],
  events: LibraryEvent[],
  today: string,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): TodayPlan {
  const { planned } = plannerData(entries, today, pagesPerHour);
  const due = planned
    .flatMap(({ entry, family, sessions, finish }) => {
      const session = sessions.find((s) => s.date === today);
      if (!session || didSession(events, entry.key, today)) return [];
      return [{ entry, family, minutes: session.minutes, finish }];
    })
    .sort(
      (a, b) =>
        b.minutes - a.minutes || a.entry.snapshot.title.localeCompare(b.entry.snapshot.title),
    );
  return { due, replanned: replannedOf(planned, events, today) };
}

// The next session to remind about, or null while snoozed or already shown recently.
export function shouldToast(
  due: DueSession[],
  memory: ToastMemory,
  now: number,
): DueSession | null {
  if (now < memory.snoozedUntil) return null;
  const fresh = (d: DueSession) => {
    const at = memory.toastedAt.get(d.entry.key);
    return at === undefined || now - at >= SNOOZE_MS;
  };
  return due.find(fresh) ?? null;
}

export const reminderText = (d: DueSession): string =>
  `${formatMinutes(d.minutes)} of ${d.entry.snapshot.title} planned for today`;

export function replannedText(r: Replanned): string {
  const sessions = r.count === 1 ? "session" : "sessions";
  return `${r.count} earlier ${sessions} re-planned · ${r.title} now finishes ${formatDay(r.finish)}`;
}
