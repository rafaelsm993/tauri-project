import { totalFor } from "./progress";
import type { Length } from "$lib/types/library";
import type { MediaDetail, MediaType } from "$lib/types/media";

export type LengthField = keyof Length;

export const REQUIRED_LENGTH_FIELDS: Record<MediaType, LengthField[]> = {
  movie: ["runtime_minutes"],
  tv: ["episodes", "episode_minutes"],
  anime: ["episodes", "episode_minutes"],
  manga: ["chapters", "chapter_minutes"],
  book: ["pages"],
  game: ["hours"],
};

export const LENGTH_LABELS: Record<LengthField, string> = {
  runtime_minutes: "Runtime (minutes)",
  episodes: "Episodes",
  episode_minutes: "Minutes per episode",
  chapters: "Chapters",
  chapter_minutes: "Minutes per chapter",
  pages: "Pages",
  hours: "Hours to finish",
};

export function emptyLength(): Length {
  return {
    runtime_minutes: null,
    episodes: null,
    episode_minutes: null,
    chapters: null,
    chapter_minutes: null,
    pages: null,
    hours: null,
  };
}

// Zero from a provider means "not published", never a real length.
const known = (value: number | null | undefined): number | null =>
  value && value > 0 ? value : null;

// No provider returns minutes per episode or a page count.
export function lengthFromDetail(type: MediaType, detail: MediaDetail | null): Length {
  const length = emptyLength();
  if (!detail) return length;
  if (type === "movie") length.runtime_minutes = known(detail.runtime);
  if (type === "tv" || type === "anime") length.episodes = known(detail.episodes);
  if (type === "manga") length.chapters = known(detail.chapters);
  if (type === "game") {
    const minutes = known(detail.runtime);
    length.hours = minutes ? Math.round(minutes / 60) : null;
  }
  return length;
}

export function missingLengthFields(type: MediaType, length: Length): LengthField[] {
  return REQUIRED_LENGTH_FIELDS[type].filter((field) => !known(length[field]));
}

// Derived, never stored: a stored flag would drift from the fields.
export function isPlannable(type: MediaType, length: Length): boolean {
  return missingLengthFields(type, length).length === 0;
}

const TOTAL_FIELD: Record<Exclude<MediaType, "movie">, LengthField> = {
  tv: "episodes",
  anime: "episodes",
  manga: "chapters",
  book: "pages",
  game: "hours",
};

// The user's own number wins; the provider is only a fallback.
export function resolveTotal(
  type: MediaType,
  detail: MediaDetail | null,
  length: Length,
): number | null {
  if (type === "movie") return 1;
  return known(length[TOTAL_FIELD[type]]) ?? totalFor(type, detail);
}
