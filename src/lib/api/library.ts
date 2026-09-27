import { invoke } from "@tauri-apps/api/core";
import type { LibraryEntry, LibraryEvent, UserData } from "$lib/types/library";

import type { MediaItem, MediaKey } from "$lib/types/media";

// Only the fields the caller wants to change; the rest stay as they are.
export type UserPatch = Partial<UserData>;

// Ids and dates are stamped here: Rust stays timezone-free and dedupes by event id.
function stamp(kind: string, media_key: MediaKey, payload: unknown = null): LibraryEvent {
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

// A save succeeded: tell listeners, never letting one of them fail the save.
async function saved<T>(event: LibraryEvent, call: Promise<T>): Promise<T> {
  const result = await call;
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

function add(item: MediaItem, user?: UserPatch): Promise<LibraryEntry> {
  const event = stamp("library_add", item.media_key, user ?? null);
  return saved(event, invoke<LibraryEntry>("library_add", { item, user, at: event.at_utc, event }));
}

function update(key: MediaKey, patch: UserPatch): Promise<LibraryEntry> {
  const event = stamp("library_update", key, patch);
  return saved(
    event,
    invoke<LibraryEntry>("library_update", { key, patch, at: event.at_utc, event }),
  );
}

function remove(key: MediaKey): Promise<boolean> {
  const event = stamp("library_remove", key);
  return saved(event, invoke<boolean>("library_remove", { key, event }));
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

export const library = { load, add, update, remove, posterDir, retryPosters, events, onEvent };
export type Library = typeof library;
