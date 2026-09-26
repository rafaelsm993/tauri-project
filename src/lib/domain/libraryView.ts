import { STATUSES, STATUS_LABELS } from "$lib/stores/library.svelte";
import { MEDIA_LABELS, type MediaType } from "$lib/types/media";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";

export type StatusFilter = LibraryStatus | "all";
export type TypeFilter = MediaType | "all";
export type FilterOption<T extends string> = { value: T; label: string; count: number };

const TYPE_ORDER: MediaType[] = ["movie", "tv", "anime", "manga", "book", "game"];

export function filterEntries(
  entries: LibraryEntry[],
  filter: { status: StatusFilter; type: TypeFilter },
): LibraryEntry[] {
  return entries.filter(
    (e) =>
      (filter.status === "all" || e.user.status === filter.status) &&
      (filter.type === "all" || e.snapshot.media_type === filter.type),
  );
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
  type: TypeFilter,
): FilterOption<StatusFilter>[] {
  const scoped = filterEntries(entries, { status: "all", type });
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
