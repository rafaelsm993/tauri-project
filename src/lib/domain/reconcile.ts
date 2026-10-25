import { CREATOR_LABEL } from "./manual";
import { LENGTH_LABELS, REQUIRED_LENGTH_FIELDS, resolveTotal } from "./length";
import { progressLabel } from "./progress";
import { STATUS_LABELS } from "$lib/stores/library.svelte";
import { formatMinutes } from "$lib/utils/format";

import type { LibraryEntry, LibraryEvent } from "$lib/types/library";
import type { MediaKey } from "$lib/types/media";

// Manual key → the catalog key it was merged into.
export type Aliases = Readonly<Record<MediaKey, MediaKey>>;

const intoOf = (payload: unknown): MediaKey | null => {
  const into = (payload as { into?: unknown } | null)?.into;
  return typeof into === "string" && into ? into : null;
};

// Only a plain map of strings is a set of aliases; e2e fakes answer unknown commands with junk.
export function asAliases(raw: unknown): Aliases {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((pair): pair is [string, string] => typeof pair[1] === "string"),
  );
}

// The saved aliases plus merges, undos and type changes heard since they were read.
export function withAliasEvents(saved: Aliases, heard: LibraryEvent[]): Aliases {
  const out: Record<MediaKey, MediaKey> = { ...saved };
  for (const e of heard) {
    const into = intoOf(e.payload);
    if (!into) continue;
    if (e.kind === "library_merge") out[e.media_key] = into;
    if (e.kind === "library_unmerge") delete out[e.media_key];
    if (e.kind === "library_retype") {
      // The new key is live again, so a record leaving it would make a loop.
      delete out[into];
      out[e.media_key] = into;
    }
  }
  return out;
}

// Where a key's history now lives; a cycle stops at the last new key.
export function resolve(key: MediaKey, aliases: Aliases): MediaKey {
  const seen = new Set([key]);
  let at = key;
  while (aliases[at] && !seen.has(aliases[at])) {
    at = aliases[at];
    seen.add(at);
  }
  return at;
}

// The log with each merged item's history filed under its catalog key.
export function rekey(events: LibraryEvent[], aliases: Aliases): LibraryEvent[] {
  if (Object.keys(aliases).length === 0) return events;
  return events.map((e) => {
    const key = resolve(e.media_key, aliases);
    return key === e.media_key ? e : { ...e, media_key: key };
  });
}

// One line of the Match screen's "What changes": the manual entry's value, then the saved one.
export interface MergeRow {
  label: string;
  before: string;
  after: string;
}

export interface MergeChanges {
  changed: MergeRow[];
  // Labels of fields that stay as they were (empty ones are left out).
  kept: string[];
  // Progress went past the new length, so it stopped at the end and the item finished.
  capped: boolean;
}

// Every field the compare step can show, as text; "" means empty.
function fields(e: LibraryEntry): [string, string][] {
  const type = e.snapshot.media_type;
  const { snapshot: s, user: u } = e;
  return [
    ["Title", s.title],
    ["Year", s.year ?? ""],
    [CREATOR_LABEL[type], s.creator ?? ""],
    ["Genres", (s.genres ?? []).join(", ")],
    ["Platforms", (s.platforms ?? []).join(", ")],
    ["Overview", s.overview ?? ""],
    ...REQUIRED_LENGTH_FIELDS[type].map((f): [string, string] => [
      LENGTH_LABELS[f],
      u.length[f]?.toString() ?? "",
    ]),
    ["Status", STATUS_LABELS[u.status]],
    ["Progress", progressLabel(type, u.progress, resolveTotal(type, null, u.length))],
    ["Rating", u.rating === null ? "" : `${u.rating}/10`],
    [
      "Plan",
      u.plan
        ? `${formatMinutes(u.plan.max_session_minutes)} per session · ${u.plan.days.map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]).join(", ")} · since ${u.plan.since}`
        : "",
    ],
    ["Review", u.review ?? ""],
  ];
}

// What a merge changes, field by field: `mine` is the manual entry, `merged` what will be saved.
export function mergeChanges(mine: LibraryEntry, merged: LibraryEntry): MergeChanges {
  const after = new Map(fields(merged));
  const changed: MergeRow[] = [];
  const kept: string[] = [];
  for (const [label, before] of fields(mine)) {
    const now = after.get(label) ?? "";
    if (now !== before) changed.push({ label, before, after: now });
    else if (before) kept.push(label);
  }
  const capped = merged.user.status === "completed" && merged.user.progress < mine.user.progress;
  return { changed, kept, capped };
}
