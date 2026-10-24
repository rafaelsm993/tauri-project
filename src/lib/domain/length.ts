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

// One-tap minutes per episode: sitcom, streaming half hour, network drama, prestige hour; anime short and standard.
export const EPISODE_MINUTE_PRESETS: Partial<Record<MediaType, number[]>> = {
  tv: [22, 30, 45, 60],
  anime: [12, 24],
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

// TMDB's series episode length and AniList's duration arrive as runtime; no provider gives pages.
export function lengthFromDetail(type: MediaType, detail: MediaDetail | null): Length {
  const length = emptyLength();
  if (!detail) return length;
  if (type === "movie") length.runtime_minutes = known(detail.runtime);
  if (type === "tv" || type === "anime") {
    length.episodes = known(detail.episodes);
    length.episode_minutes = known(detail.runtime);
  }
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

// What lengthFromDetail can ever fill; pages and minutes per chapter come from the user (or Settings).
const CATALOG_FIELDS: LengthField[] = [
  "runtime_minutes",
  "episodes",
  "episode_minutes",
  "chapters",
  "hours",
];

export function catalogCanFill(type: MediaType, length: Length): boolean {
  return missingLengthFields(type, length).some((field) => CATALOG_FIELDS.includes(field));
}

// The user's own number wins; the catalog only fills what is unknown.
export function fillMissing(length: Length, from: Length): Length {
  const out = { ...length };
  for (const field of Object.keys(out) as LengthField[]) {
    if (!known(out[field])) out[field] = known(from[field]);
  }
  return out;
}

// Fields neither the user nor the catalog knows; empty until the catalog has answered.
export function catalogGap(
  type: MediaType,
  length: Length,
  detail: MediaDetail | null,
): LengthField[] {
  if (!detail) return [];
  return missingLengthFields(type, fillMissing(length, lengthFromDetail(type, detail)));
}

// Why a length matters, for a catalog item the provider can't measure.
export function lengthGapNote(provider: string, title: string, fields: LengthField[]): string {
  const what = fields.map((f) => LENGTH_LABELS[f].toLowerCase()).join(" or ");
  return `${provider} doesn't list the ${what} for ${title}. Add it yourself: your plan is only as accurate as this number.`;
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

// No provider publishes minutes per chapter, so a manga without its own starts from Settings.
export function withChapterDefault(
  type: MediaType,
  length: Length,
  minutes: number | null,
): Length {
  if (type !== "manga" || known(length.chapter_minutes) || !minutes) return length;
  return { ...length, chapter_minutes: minutes };
}
