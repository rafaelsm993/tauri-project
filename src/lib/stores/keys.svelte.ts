import {
  keys as defaultClient,
  type KeyPresence,
  type Keyed,
  type KeysClient,
} from "$lib/api/keys";
import type { MediaType } from "$lib/types/media";
import { errorMessage } from "$lib/utils/errors";

const NONE: KeyPresence = { tmdb: false, rawg: false };

// Which provider serves a media type; the keyless ones are absent.
const NEEDS: Partial<Record<MediaType, Keyed>> = {
  movie: "tmdb",
  tv: "tmdb",
  game: "rawg",
};

// Whether the user's API keys are set, and the one place that saves them.
export class KeysStore {
  private client: KeysClient;

  presence = $state<KeyPresence>({ ...NONE });
  ready = $state(false);
  busy = $state(false);
  private errors = $state<Partial<Record<Keyed, string>>>({});

  constructor(client: KeysClient = defaultClient) {
    this.client = client;
  }

  async hydrate(): Promise<void> {
    if (this.ready) return;
    try {
      this.presence = await this.client.status();
    } catch {
      this.presence = { ...NONE };
    } finally {
      this.ready = true;
    }
  }

  errorFor(which: Keyed): string {
    return this.errors[which] ?? "";
  }

  // A media type whose provider has no key cannot answer.
  needsKey(type: MediaType): boolean {
    const which = NEEDS[type];
    return which ? !this.presence[which] : false;
  }

  // Asks the provider first, so a refused key is never written to disk.
  async save(which: Keyed, key: string): Promise<boolean> {
    this.busy = true;
    this.errors = { ...this.errors, [which]: "" };
    try {
      await this.client.check(which, key);
      this.presence = await this.client.set(which, key);
      return true;
    } catch (e) {
      this.errors = { ...this.errors, [which]: errorMessage(e, "Could not save that key.") };
      return false;
    } finally {
      this.busy = false;
    }
  }

  async forget(which: Keyed): Promise<void> {
    this.errors = { ...this.errors, [which]: "" };
    try {
      this.presence = await this.client.clear(which);
    } catch (e) {
      this.errors = { ...this.errors, [which]: errorMessage(e, "Could not remove that key.") };
    }
  }
}

export const keysStore = new KeysStore();
