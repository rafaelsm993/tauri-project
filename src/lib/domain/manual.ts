import { familyOf, type Family } from "./dashboard";
import type { LibraryEntry, ManualDraft, MediaSnapshot } from "$lib/types/library";
import type { MediaDetail, MediaKey, MediaType } from "$lib/types/media";

// What the creator field is called for each type.
export const CREATOR_LABEL: Record<MediaType, string> = {
  movie: "Director",
  tv: "Creator",
  anime: "Studio",
  manga: "Author",
  book: "Author",
  game: "Developer",
};

export const isManual = (key: MediaKey): boolean => key.startsWith("manual:");

// The id part of a manual key: Rust makes it a UUID, which no provider id looks like.
export const isManualId = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const blankToNone = (s: string | null | undefined): string | undefined => s?.trim() || undefined;

// Trimmed, blanks dropped, first spelling kept on case-insensitive repeats (as Rust does).
function uniqueTags(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const tag of raw.map((t) => t.trim()).filter(Boolean)) {
    if (!out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}

// The form's comma-separated text as tags.
export const splitTags = (text: string): string[] => uniqueTags(text.split(","));

// For comparing titles: no case, accents, punctuation or extra spaces.
export const normalizeTitle = (title: string): string =>
  title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// A saved item that looks like the draft: same type and title, and same year when both have one.
export function duplicateOf(
  entries: LibraryEntry[],
  draft: Pick<ManualDraft, "media_type" | "title" | "year">,
  except?: MediaKey,
): LibraryEntry | undefined {
  const title = normalizeTitle(draft.title);
  if (!title) return undefined;
  const year = blankToNone(draft.year);
  return entries.find(
    (e) =>
      e.key !== except &&
      e.snapshot.media_type === draft.media_type &&
      normalizeTitle(e.snapshot.title) === title &&
      (!year || !e.snapshot.year || e.snapshot.year === year),
  );
}

// A drawn poster for items without one: the title's first letter or digit on the family hue.
export function placeholderOf(
  title: string | undefined,
  type: MediaType,
): { initial: string; family: Family } {
  const first = title?.match(/[\p{L}\p{N}]/u)?.[0];
  return { initial: first ? first.toUpperCase() : "?", family: familyOf(type) };
}

// The snapshot after an edit, tidied the way Rust stores it, so the optimistic view matches.
export function applyDraft(snapshot: MediaSnapshot, draft: ManualDraft): MediaSnapshot {
  return {
    ...snapshot,
    title: draft.title.trim(),
    year: blankToNone(draft.year) ?? null,
    creator: blankToNone(draft.creator),
    overview: blankToNone(draft.overview),
    genres: uniqueTags(draft.genres ?? []),
    platforms: snapshot.media_type === "game" ? uniqueTags(draft.platforms ?? []) : [],
  };
}

// A hand-made item in the detail page's shape, so it draws with the same meta and overview.
export function manualDetail(snapshot: MediaSnapshot): MediaDetail {
  return {
    id: snapshot.media_key.split(":").slice(2).join(":"),
    provider: snapshot.provider,
    media_key: snapshot.media_key,
    media_type: snapshot.media_type,
    title: snapshot.title,
    tagline: "",
    overview: snapshot.overview ?? "",
    poster_path: snapshot.poster_path,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    release_date: snapshot.year ?? "",
    runtime: null,
    genres: (snapshot.genres ?? []).map((name) => ({ id: name, name })),
    cast: [],
    videos: [],
    author: snapshot.creator,
    platforms: snapshot.platforms?.length ? snapshot.platforms : undefined,
  };
}
