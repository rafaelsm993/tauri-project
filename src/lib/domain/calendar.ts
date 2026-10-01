const DAY_MS = 86_400_000;

export const isDay = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date);

// Calendar-day number of a local `YYYY-MM-DD` date; no clock or time zone is involved.
export const dayNumber = (date: string): number =>
  Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

export const dateOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string => dateOf(dayNumber(date) + days);

// 0 = Monday … 6 = Sunday.
export const weekday = (date: string): number =>
  (new Date(dayNumber(date) * DAY_MS).getUTCDay() + 6) % 7;

// Monday of the week the date falls in.
export const weekStart = (date: string): string => addDays(date, -weekday(date));

// The local calendar day of a moment, as `YYYY-MM-DD`.
export const localDay = (at: Date = new Date()): string => at.toLocaleDateString("en-CA");
