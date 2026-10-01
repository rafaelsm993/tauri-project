import { hoursDone } from "./dashboard";
import { hoursOf } from "./gamification";
import { missingLengthFields, type LengthField } from "./length";
import type { LibraryEntry } from "$lib/types/library";

// Placeholder until the user's own pace lands in prefs (GOALS §5.4: asked once, kept).
export const DEFAULT_PAGES_PER_HOUR = 30;

export type Estimate =
  | { kind: "plannable"; totalMinutes: number; doneMinutes: number; remainingMinutes: number }
  | { kind: "needs"; missing: LengthField[] }
  | { kind: "dropped" };

const toMinutes = (hours: number): number => Math.round(hours * 60);

// Minutes total, done and left; "needs" names the fields to ask for; dropped items are not planned.
export function estimate(
  entry: LibraryEntry,
  pagesPerHour: number = DEFAULT_PAGES_PER_HOUR,
): Estimate {
  const { media_type: type } = entry.snapshot;
  const { length, progress, status } = entry.user;
  if (status === "dropped") return { kind: "dropped" };
  const missing = missingLengthFields(type, length);
  if (missing.length > 0) return { kind: "needs", missing };
  if (type === "book") {
    const pages = length.pages ?? 0;
    const read = status === "completed" ? pages : Math.min(pages, Math.max(0, progress));
    const totalMinutes = toMinutes(pages / pagesPerHour);
    const doneMinutes = toMinutes(read / pagesPerHour);
    return {
      kind: "plannable",
      totalMinutes,
      doneMinutes,
      remainingMinutes: totalMinutes - doneMinutes,
    };
  }
  const totalMinutes = toMinutes(hoursOf(type, length) ?? 0);
  const doneMinutes = Math.min(totalMinutes, toMinutes(hoursDone(entry)));
  return {
    kind: "plannable",
    totalMinutes,
    doneMinutes,
    remainingMinutes: totalMinutes - doneMinutes,
  };
}
