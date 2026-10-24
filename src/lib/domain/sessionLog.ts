import { addDays, weekday } from "./calendar";
import { DEFAULT_PAGES_PER_HOUR, estimate } from "./estimate";
import { resolveTotal } from "./length";
import { planFor } from "./planner";
import type { LibraryEntry, LibraryStatus, Plan } from "$lib/types/library";

export interface LogPreview {
  // Units this session adds (episodes, chapters, pages, hours; 1 for a movie).
  gained: number;
  progress: number;
  total: number | null;
  status: LibraryStatus;
  finishes: boolean;
  remainingMinutes: number;
  sessionsLeft: number;
  finish: string | null;
  plannedDay: boolean;
}

// Minutes one unit of progress takes; null when the item has no length to convert with.
export function minutesPerUnit(
  entry: LibraryEntry,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): number | null {
  const { length } = entry.user;
  switch (entry.snapshot.media_type) {
    case "tv":
    case "anime":
      return length.episode_minutes || null;
    case "manga":
      return length.chapter_minutes || null;
    case "book":
      return pagesPerHour > 0 ? 60 / pagesPerHour : null;
    case "game":
      return 60;
    case "movie":
      return length.runtime_minutes || null;
  }
}

// Whole units `minutes` is worth, nearest (half up), capped at what is left. Without a length one
// session is one unit; a movie is watched or not.
function unitsFor(entry: LibraryEntry, minutes: number, pagesPerHour: number): number {
  const { media_type: type } = entry.snapshot;
  if (type === "movie") return 1;
  const per = minutesPerUnit(entry, pagesPerHour);
  const units = per ? Math.round(minutes / per) : 1;
  const total = resolveTotal(type, null, entry.user.length);
  return total === null ? units : Math.max(0, Math.min(units, total - entry.user.progress));
}

// What logging `minutes` today would record, and what the plan looks like after it.
export function logPreview(
  entry: LibraryEntry,
  plan: Plan,
  minutes: number,
  today: string,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): LogPreview {
  const { media_type: type } = entry.snapshot;
  const { progress, status, length } = entry.user;
  const total = resolveTotal(type, null, length);
  // A short session may record nothing; it still counts as the session.
  const gained = unitsFor(entry, minutes, pagesPerHour);
  const after = progress + gained;
  const finishes = total !== null && after >= total;
  const nextStatus: LibraryStatus = finishes
    ? "completed"
    : status === "planning"
      ? "in_progress"
      : status;
  const plannedDay = plan.days.includes(weekday(today));
  const base = { gained, progress: after, total, status: nextStatus, finishes, plannedDay };
  if (finishes) return { ...base, remainingMinutes: 0, sessionsLeft: 0, finish: null };

  const next: LibraryEntry = {
    ...entry,
    user: { ...entry.user, progress: after, status: nextStatus },
  };
  const left = estimate(next, pagesPerHour);
  // Today's session is the one being logged, so what is left starts tomorrow.
  const rest = planFor(next, plan, addDays(today, 1), pagesPerHour);
  return {
    ...base,
    remainingMinutes: left.kind === "plannable" ? left.remainingMinutes : 0,
    sessionsLeft: rest.kind === "planned" ? rest.sessions.length : 0,
    finish: rest.kind === "planned" ? rest.finish : null,
  };
}

// Pre-filled length: today's due session, else the next one the plan schedules, else its cap.
export function defaultMinutes(
  entry: LibraryEntry,
  plan: Plan,
  today: string,
  dueMinutes: number | null,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): number {
  if (dueMinutes !== null) return dueMinutes;
  const next = planFor(entry, plan, today, pagesPerHour);
  return next.kind === "planned" ? next.sessions[0].minutes : plan.max_session_minutes;
}
