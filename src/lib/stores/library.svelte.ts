import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { library as defaultClient } from "$lib/api/library";
import { emptyLength } from "$lib/domain/length";
import { errorMessage } from "$lib/utils/errors";
import type { LibraryEntry, LibraryStatus, UserData } from "$lib/types/library";
import type { MediaItem, MediaKey } from "$lib/types/media";

export type LibraryClient = {
  load: () => Promise<LibraryEntry[]>;
  add: (item: MediaItem, user?: Partial<UserData>) => Promise<LibraryEntry>;
  update: (key: MediaKey, patch: Partial<UserData>) => Promise<LibraryEntry>;
  remove: (key: MediaKey) => Promise<boolean>;
  posterDir: () => Promise<string>;
  retryPosters: () => Promise<void>;
};

export const STATUSES: LibraryStatus[] = ["planning", "in_progress", "completed", "dropped"];

// Neutral wording for every media type (GOALS-QA L1).
export const STATUS_LABELS: Record<LibraryStatus, string> = {
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
  dropped: "Dropped",
};

// What the UI shows for an entry the backend has not confirmed yet.
function optimisticEntry(item: MediaItem, user: Partial<UserData>): LibraryEntry {
  const now = new Date().toISOString();
  return {
    key: item.media_key,
    snapshot: {
      media_key: item.media_key,
      provider: item.provider,
      media_type: item.media_type,
      title: item.title,
      poster_path: item.poster_path ?? null,
      year: null,
      poster_file: null,
    },
    user: {
      status: "planning",
      progress: 0,
      rating: null,
      review: null,
      length: emptyLength(),
      ...user,
    },
    created_at: now,
    updated_at: now,
  };
}

// The user's collection: optimistic in front, the backend as the source of truth.
export class LibraryStore {
  private client: LibraryClient;
  private map = new SvelteMap<MediaKey, LibraryEntry>();
  private inFlight = new SvelteSet<MediaKey>();

  ready = $state(false);
  error = $state("");
  posterDir = $state<string | null>(null);

  entries = $derived(
    [...this.map.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  );

  countByStatus = $derived(
    STATUSES.reduce(
      (acc, status) => {
        acc[status] = this.entries.filter((e) => e.user.status === status).length;
        return acc;
      },
      {} as Record<LibraryStatus, number>,
    ),
  );

  constructor(client: LibraryClient = defaultClient) {
    this.client = client;
  }

  has = (key: MediaKey): boolean => this.map.has(key);
  get = (key: MediaKey): LibraryEntry | undefined => this.map.get(key);
  isPending = (key: MediaKey): boolean => this.inFlight.has(key);

  async hydrate(): Promise<void> {
    if (this.ready) return;
    try {
      const [saved, dir] = await Promise.all([this.client.load(), this.loadPosterDir()]);
      this.posterDir = dir;
      this.map.clear();
      for (const e of saved) this.map.set(e.key, e);
      this.ready = true;
    } catch (e) {
      this.error = errorMessage(e, "Failed to load your library.");
    }
  }

  // An import replaced the data underneath; read it again.
  async reload(): Promise<void> {
    this.ready = false;
    this.error = "";
    await this.hydrate();
  }

  // Without the folder the cards use remote posters; it must never fail the library.
  private async loadPosterDir(): Promise<string | null> {
    try {
      const dir = await this.client.posterDir();
      return typeof dir === "string" && dir ? dir : null;
    } catch {
      return null;
    }
  }

  // Best effort: cards keep the remote poster until a local copy exists.
  async retryPosters(): Promise<void> {
    try {
      await this.client.retryPosters();
    } catch (e) {
      console.warn("[library] poster retry failed", e);
    }
  }

  async add(item: MediaItem, user: Partial<UserData> = {}): Promise<void> {
    const key = item.media_key;
    if (this.map.has(key)) return;
    this.error = "";
    this.write(key, optimisticEntry(item, user));
    this.mark(key, true);
    try {
      this.write(key, await this.client.add(item, user));
    } catch (e) {
      this.drop(key);
      this.error = errorMessage(e, "Failed to save this item.");
    } finally {
      this.mark(key, false);
    }
  }

  async update(key: MediaKey, patch: Partial<UserData>): Promise<void> {
    const before = this.map.get(key);
    if (!before) return;
    this.error = "";
    this.write(key, { ...before, user: { ...before.user, ...patch } });
    this.mark(key, true);
    try {
      this.write(key, await this.client.update(key, patch));
    } catch (e) {
      this.write(key, before);
      this.error = errorMessage(e, "Failed to save the change.");
    } finally {
      this.mark(key, false);
    }
  }

  async remove(key: MediaKey): Promise<void> {
    const before = this.map.get(key);
    if (!before) return;
    this.error = "";
    this.drop(key);
    this.mark(key, true);
    try {
      await this.client.remove(key);
    } catch (e) {
      this.write(key, before);
      this.error = errorMessage(e, "Failed to remove this item.");
    } finally {
      this.mark(key, false);
    }
  }

  // SvelteMap and SvelteSet are reactive on mutation, so no copying is needed.
  private write(key: MediaKey, entry: LibraryEntry) {
    this.map.set(key, entry);
  }

  private drop(key: MediaKey) {
    this.map.delete(key);
  }

  private mark(key: MediaKey, pending: boolean) {
    if (pending) this.inFlight.add(key);
    else this.inFlight.delete(key);
  }
}

export const libraryStore = new LibraryStore();
