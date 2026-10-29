import { STATUSES, STATUS_LABELS } from "$lib/stores/library.svelte";
import { MEDIA_LABELS, type MediaType } from "$lib/types/media";
import type { DueSession } from "./reminders";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";

export type LibraryViewMode = "grid" | "garden";
export const VIEW_OPTIONS: { value: LibraryViewMode; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "garden", label: "Tree" },
];

export type StatusFilter = LibraryStatus | "all";
// A Type option; "all" is the panel's button that clears every picked type.
export type TypeFilter = MediaType | "all";
export type FilterOption<T extends string> = { value: T; label: string; count: number };
// An empty `types` list means every type.
export type LibraryFilter = { status: StatusFilter; types: readonly MediaType[] };

export const TYPE_ORDER: MediaType[] = ["movie", "tv", "anime", "manga", "book", "game"];

export function filterEntries(entries: LibraryEntry[], filter: LibraryFilter): LibraryEntry[] {
  return entries.filter(
    (e) =>
      (filter.status === "all" || e.user.status === filter.status) &&
      (filter.types.length === 0 || filter.types.includes(e.snapshot.media_type)),
  );
}

// Adds or removes one type; the result follows TYPE_ORDER so chips and counts read the same way.
export function toggleType(types: readonly MediaType[], type: MediaType): MediaType[] {
  const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
  return TYPE_ORDER.filter((t) => next.includes(t));
}

// Case- and accent-insensitive form used for title search.
export function normalizeTitle(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

// Keeps entries whose title contains every word of the query, in any order.
export function searchEntries(entries: LibraryEntry[], query: string): LibraryEntry[] {
  const words = normalizeTitle(query).split(" ").filter(Boolean);
  if (words.length === 0) return entries;
  return entries.filter((e) => {
    const title = normalizeTitle(e.snapshot.title);
    return words.every((w) => title.includes(w));
  });
}

// Counts follow the type filter so the numbers match what a click would show.
export function statusOptions(
  entries: LibraryEntry[],
  types: readonly MediaType[],
): FilterOption<StatusFilter>[] {
  const scoped = filterEntries(entries, { status: "all", types });
  return [
    { value: "all", label: "All", count: scoped.length },
    ...STATUSES.map((status) => ({
      value: status,
      label: STATUS_LABELS[status],
      count: scoped.filter((e) => e.user.status === status).length,
    })),
  ];
}

// Offers the types in `library` so the control stays put while a search narrows `entries`.
export function typeOptions(
  entries: LibraryEntry[],
  library: LibraryEntry[] = entries,
): FilterOption<TypeFilter>[] {
  const has = (t: MediaType) => library.some((e) => e.snapshot.media_type === t);
  const count = (t: MediaType) => entries.filter((e) => e.snapshot.media_type === t).length;
  return [
    { value: "all", label: "All", count: entries.length },
    ...TYPE_ORDER.filter(has).map((t) => ({
      value: t,
      label: MEDIA_LABELS[t],
      count: count(t),
    })),
  ];
}

// Media keys are `provider:type:id`, and ids may contain colons.
export function detailPath(entry: LibraryEntry): { type: MediaType; id: string } {
  const id = entry.key.split(":").slice(2).join(":");
  return { type: entry.snapshot.media_type, id };
}

// Home's Continue row: what you are in the middle of, newest activity first.
export function continueEntries(entries: LibraryEntry[], max = 12): LibraryEntry[] {
  return entries
    .filter((e) => e.user.status === "in_progress")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, max);
}

export interface ContinueItem {
  entry: LibraryEntry;
  // Today's planned minutes when the item has a session today.
  dueMinutes: number | null;
}

// Today's sessions lead, in the planner's order; then what you are in the middle of. A due
// session is never cut by the cap, and a Planning item with one is included.
export function continueItems(
  entries: LibraryEntry[],
  due: DueSession[],
  max = 12,
): ContinueItem[] {
  const dueKeys = new Set(due.map((d) => d.entry.key));
  const lead = due.map((d) => ({ entry: d.entry, dueMinutes: d.minutes }));
  const rest = continueEntries(entries, max)
    .filter((e) => !dueKeys.has(e.key))
    .map((entry) => ({ entry, dueMinutes: null }));
  return [...lead, ...rest].slice(0, Math.max(max, lead.length));
}

// Zero-item options stay visible but can't be picked; a picked one can always be switched off.
export function withEmptyDisabled<T extends string>(
  options: FilterOption<T>[],
  picked: T | readonly T[],
): (FilterOption<T> & { disabled: boolean })[] {
  const on = (v: T) => (typeof picked === "string" ? v === picked : picked.includes(v));
  return options.map((o) => ({ ...o, disabled: o.count === 0 && !on(o.value) }));
}

export const activeFilterCount = (f: LibraryFilter): number =>
  Number(f.status !== "all") + f.types.length;
