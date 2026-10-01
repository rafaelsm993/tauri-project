import { addDays, weekday, weekStart } from "./calendar";

// 0 = Monday … 6 = Sunday.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Conditions {
  days: Weekday[];
  maxSessionMinutes: number;
}

export interface Session {
  date: string;
  minutes: number;
}

export type Schedule =
  | { kind: "done" }
  | { kind: "impossible"; reason: "no-days" | "no-time" }
  | {
      kind: "planned";
      sessions: Session[];
      finish: string;
      weekly: { week: string; minutes: number }[];
    };

// Spreads the remaining minutes over the next available days from `from` (inclusive), in even sessions.
export function schedule(remainingMinutes: number, conditions: Conditions, from: string): Schedule {
  const left = Math.max(0, Math.round(remainingMinutes));
  if (left === 0) return { kind: "done" };
  const days = new Set(conditions.days);
  if (days.size === 0) return { kind: "impossible", reason: "no-days" };
  const cap = Math.floor(conditions.maxSessionMinutes);
  if (cap <= 0) return { kind: "impossible", reason: "no-time" };
  const count = Math.ceil(left / cap);
  const base = Math.floor(left / count);
  const extra = left % count;
  const sessions: Session[] = [];
  for (let date = from; sessions.length < count; date = addDays(date, 1)) {
    if (!days.has(weekday(date) as Weekday)) continue;
    sessions.push({ date, minutes: base + (sessions.length < extra ? 1 : 0) });
  }
  const weekly = new Map<string, number>();
  for (const s of sessions)
    weekly.set(weekStart(s.date), (weekly.get(weekStart(s.date)) ?? 0) + s.minutes);
  return {
    kind: "planned",
    sessions,
    finish: sessions[sessions.length - 1].date,
    weekly: [...weekly].map(([week, minutes]) => ({ week, minutes })),
  };
}
