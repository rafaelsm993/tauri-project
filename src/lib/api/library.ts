import { invoke } from "@tauri-apps/api/core";
import type {
  EventKind,
  LibraryEntry,
  Length,
  LibraryEvent,
  ManualDraft,
  MergePreview,
  Plan,
  Unmerged,
  UserData,
} from "$lib/types/library";

import type { MediaItem, MediaKey } from "$lib/types/media";

// Only the fields the caller wants to change; the rest stay as they are.
export type UserPatch = Partial<UserData>;

// Ids and dates are stamped here: Rust stays timezone-free and dedupes by event id.
function stamp(kind: EventKind, media_key: MediaKey, payload: unknown = null): LibraryEvent {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    kind,
    media_key,
    at_utc: now.toISOString(),
    local_date: now.toLocaleDateString("en-CA"),
    payload,
  };
}

type EventListener = (event: LibraryEvent) => void;
const listeners = new Set<EventListener>();

// Hears every event the backend accepted; returns the unsubscribe.
function onEvent(fn: EventListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// A save the backend logged: tell listeners, never letting one of them fail the save.
async function saved<T>(
  event: LibraryEvent,
  call: Promise<T>,
  logged: (result: T) => boolean = () => true,
): Promise<T> {
  const result = await call;
  if (!logged(result)) return result;
  for (const fn of listeners) {
    try {
      fn(event);
    } catch (e) {
      console.error("[library] event listener failed", e);
    }
  }
  return result;
}

function load(): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>("library_load");
}

// A re-add returns the existing entry untouched and logs nothing.
function add(item: MediaItem, user?: UserPatch): Promise<LibraryEntry> {
  const event = stamp("library_add", item.media_key, user ?? null);
  return saved(
    event,
    invoke<LibraryEntry>("library_add", { item, user, event }),
    (entry) => entry?.created_at === event.at_utc,
  );
}

// Rust makes the key, so the event goes out keyless and listeners get the stamped copy.
async function addManual(draft: ManualDraft, user?: UserPatch): Promise<LibraryEntry> {
  const event = stamp("library_add", "", user ?? null);
  const entry = await invoke<LibraryEntry>("library_add_manual", { draft, user, event });
  return saved({ ...event, media_key: entry.key }, Promise.resolve(entry));
}

// Logged as `library_edit`, which earns no XP.
function editManual(key: MediaKey, draft: ManualDraft): Promise<LibraryEntry> {
  const event = stamp("library_edit", key, draft);
  return saved(event, invoke<LibraryEntry>("library_edit_manual", { key, draft, event }));
}

// Moves a manual item to `draft.media_type`; Rust keeps its id, so the new key is known here.
function retypeManual(key: MediaKey, draft: ManualDraft, length: Length): Promise<LibraryEntry> {
  const into = `manual:${draft.media_type}:${key.split(":").slice(2).join(":")}`;
  const event = stamp("library_retype", key, { into });
  return saved(event, invoke<LibraryEntry>("library_retype_manual", { key, draft, length, event }));
}

function update(key: MediaKey, patch: UserPatch): Promise<LibraryEntry> {
  const event = stamp("library_update", key, patch);
  return saved(event, invoke<LibraryEntry>("library_update", { key, patch, event }));
}

// Sets or clears (null) an item's plan; logged as `library_plan`, which earns no XP.
function plan(key: MediaKey, value: Plan | null): Promise<LibraryEntry> {
  const event = stamp("library_plan", key, value);
  return saved(
    event,
    invoke<LibraryEntry>("library_update", {
      key,
      patch: { plan: value },
      event,
    }),
  );
}

function remove(key: MediaKey): Promise<boolean> {
  const event = stamp("library_remove", key);
  return saved(event, invoke<boolean>("library_remove", { key, event }), (gone) => gone === true);
}

function posterDir(): Promise<string> {
  return invoke<string>("library_poster_dir");
}

function retryPosters(): Promise<void> {
  return invoke<void>("library_retry_posters");
}

// The activity log, oldest first; XP, levels and streaks are derived from it.
function events(): Promise<LibraryEvent[]> {
  return invoke<LibraryEvent[]>("library_events");
}

// A dry run of `merge`: what would be saved, or the reason it would be refused.
function mergePreview(key: MediaKey, item: MediaItem, length: Length): Promise<MergePreview> {
  return invoke<MergePreview>("library_merge_preview", { key, item, catalogLength: length });
}

// Rust fills the payload with the catalog key, so listeners get the event as it was logged.
async function merge(key: MediaKey, item: MediaItem, length: Length): Promise<LibraryEntry> {
  const event = stamp("library_merge", key);
  const entry = await invoke<LibraryEntry>("library_merge", {
    key,
    item,
    catalogLength: length,
    event,
  });
  return saved({ ...event, payload: { into: entry.key } }, Promise.resolve(entry));
}

async function unmerge(key: MediaKey): Promise<Unmerged> {
  const event = stamp("library_unmerge", key);
  const back = await invoke<Unmerged>("library_unmerge", { key, event });
  return saved({ ...event, payload: { into: back.into } }, Promise.resolve(back));
}

// Manual key → where its history lives now: a catalog match or a type change.
function aliases(): Promise<Record<MediaKey, MediaKey>> {
  return invoke<Record<MediaKey, MediaKey>>("library_aliases");
}

export const library = {
  load,
  add,
  addManual,
  editManual,
  retypeManual,
  update,
  plan,
  remove,
  posterDir,
  retryPosters,
  events,
  onEvent,
  mergePreview,
  merge,
  unmerge,
  aliases,
};
export type Library = typeof library;
