import type { LibraryEvent } from "$lib/types/library";
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

// The saved aliases plus merges and undos heard since they were read.
export function withAliasEvents(saved: Aliases, heard: LibraryEvent[]): Aliases {
  const out: Record<MediaKey, MediaKey> = { ...saved };
  for (const e of heard) {
    const into = intoOf(e.payload);
    if (!into) continue;
    if (e.kind === "library_merge") out[e.media_key] = into;
    if (e.kind === "library_unmerge") delete out[e.media_key];
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
