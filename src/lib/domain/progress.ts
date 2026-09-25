import type { MediaDetail, MediaType } from "$lib/types/media";

export interface ProgressUnit {
  one: string;
  many: string;
  // A movie is watched or not; everything else counts.
  binary?: true;
}

export const PROGRESS_UNITS: Record<MediaType, ProgressUnit> = {
  movie: { one: "", many: "", binary: true },
  tv: { one: "episode", many: "episodes" },
  anime: { one: "episode", many: "episodes" },
  manga: { one: "chapter", many: "chapters" },
  book: { one: "page", many: "pages" },
  game: { one: "hour", many: "hours" },
};

export const isBinary = (type: MediaType): boolean => PROGRESS_UNITS[type].binary === true;

export function unitLabel(type: MediaType, count: number): string {
  const unit = PROGRESS_UNITS[type];
  return count === 1 ? unit.one : unit.many;
}

// Whole units only; a movie is 0 or 1 and progress never goes negative.
export function clampProgress(type: MediaType, value: number): number {
  const whole = Math.max(0, Math.floor(value));
  return isBinary(type) ? Math.min(1, whole) : whole;
}

// RAWG playtime arrives as minutes.
function gameHours(runtime: number | null | undefined): number | null {
  return runtime && runtime > 0 ? Math.round(runtime / 60) : null;
}

// The provider's length, or null when it does not publish one.
export function totalFor(type: MediaType, detail: MediaDetail | null): number | null {
  if (type === "movie") return 1;
  if (!detail) return null;
  const raw =
    type === "tv" || type === "anime"
      ? detail.episodes
      : type === "manga"
        ? detail.chapters
        : type === "game"
          ? gameHours(detail.runtime)
          : null;
  return raw && raw > 0 ? raw : null;
}

// Null total means the bar has nothing honest to show.
export function percent(progress: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((progress / total) * 100));
}

export function progressLabel(type: MediaType, progress: number, total: number | null): string {
  if (isBinary(type)) return progress > 0 ? "Watched" : "Not watched";
  if (progress <= 0) return "Not started";
  const unit = unitLabel(type, progress);
  return total ? `${progress} of ${total} ${unit}` : `${progress} ${unit}`;
}
