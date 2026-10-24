import { DEFAULT_PAGES_PER_HOUR, estimate } from "./estimate";
import { resolveTotal } from "./length";
import { fullSession, minutesPerUnit } from "./sessionLog";
import { formatMinutes, plural } from "$lib/utils/format";
import type { LibraryEntry } from "$lib/types/library";

export const MAX_SESSION = 720;
const TIME_STEP = 30;

// How a session is measured: whole units (episode, chapter) or time in 30 min steps.
export interface SessionScale {
  kind: "units" | "time";
  // Minutes one arrow tap moves.
  step: number;
  // Most steps a session can take; at least 1.
  steps: number;
  // Shortest session, for the arrows and Custom alike.
  min: number;
  noun: string;
  // "Full episode"/"Full chapter" for one unit; null for time.
  full: string | null;
  // Books show the pages the time is worth.
  pages: boolean;
}

// The picker's state, owned by the sheet.
export interface SessionChoice {
  count: number;
  custom: boolean;
  typed: number;
}

// Null for a movie (its own control), without a length, or when one unit is over 12 h.
export function sessionScale(
  entry: LibraryEntry,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): SessionScale | null {
  const type = entry.snapshot.media_type;
  if (type === "movie") return null;
  if (type === "tv" || type === "anime" || type === "manga") {
    const per = minutesPerUnit(entry);
    if (!per || per > MAX_SESSION) return null;
    const total = resolveTotal(type, null, entry.user.length);
    const left = total === null ? Infinity : total - entry.user.progress;
    return {
      kind: "units",
      step: per,
      steps: Math.max(1, Math.min(Math.floor(MAX_SESSION / per), left)),
      min: per,
      noun: type === "manga" ? "chapter" : "episode",
      full: fullSession(entry)?.label ?? null,
      pages: false,
    };
  }
  const left = estimate(entry, pagesPerHour);
  if (left.kind !== "plannable") return null;
  // 30 min, unless the whole item or what is left of it is shorter.
  const step = Math.max(1, Math.min(TIME_STEP, left.totalMinutes, left.remainingMinutes));
  return {
    kind: "time",
    step,
    steps: Math.max(
      1,
      Math.min(Math.floor(MAX_SESSION / step), Math.ceil(left.remainingMinutes / step)),
    ),
    min: step,
    noun: "",
    full: null,
    pages: type === "book",
  };
}

const clamp = (scale: SessionScale, n: number) => Math.min(scale.steps, Math.max(1, n));

// Whole steps nearest to `minutes`; 1 when there is nothing to round.
export function nearestCount(scale: SessionScale, minutes: number): number {
  return Number.isFinite(minutes) ? clamp(scale, Math.round(minutes / scale.step)) : 1;
}

export function choiceMinutes(scale: SessionScale, choice: SessionChoice): number {
  return choice.custom ? choice.typed : clamp(scale, choice.count) * scale.step;
}

export function choiceOk(scale: SessionScale, minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= scale.min && minutes <= MAX_SESSION;
}

// Where a sheet opens: whole steps, or Custom with the exact minutes; `snap` always rounds.
export function openAt(scale: SessionScale, minutes: number, snap: boolean): SessionChoice {
  const count = nearestCount(scale, minutes);
  const whole = minutes % scale.step === 0;
  if (snap || whole || minutes < scale.min) {
    return { count, custom: false, typed: count * scale.step };
  }
  return { count, custom: true, typed: minutes };
}

// The centre's two lines.
export function sessionText(
  scale: SessionScale,
  minutes: number,
  pagesPerHour: number,
): { title: string; detail: string } {
  if (scale.kind === "units") {
    const n = minutes / scale.step;
    if (Number.isInteger(n)) {
      return {
        title: n === 1 && scale.full ? scale.full : plural(n, scale.noun),
        detail: formatMinutes(minutes),
      };
    }
    return {
      title: formatMinutes(minutes),
      detail: `≈ ${plural(Math.max(1, Math.round(n)), scale.noun)}`,
    };
  }
  return {
    title: formatMinutes(minutes),
    detail: scale.pages ? `≈ ${plural(Math.round((minutes * pagesPerHour) / 60), "page")}` : "",
  };
}

export function tooShortText(scale: SessionScale): string {
  return scale.kind === "units"
    ? `At least one ${scale.noun} (${formatMinutes(scale.min)}).`
    : `At least ${formatMinutes(scale.min)}.`;
}
