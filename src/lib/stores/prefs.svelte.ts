import { prefs as defaultClient, type PrefsClient } from "$lib/api/prefs";
import { DEFAULT_PREFS, type Prefs, type PrefsPatch } from "$lib/types/prefs";
import { errorMessage } from "$lib/utils/errors";

// Keeps only known fields with the right type; e2e fakes answer unknown commands with junk.
function normalize(raw: unknown): Prefs {
  const r = (raw ?? {}) as Partial<Record<keyof Prefs, unknown>>;
  return {
    background_animation:
      typeof r.background_animation === "boolean"
        ? r.background_animation
        : DEFAULT_PREFS.background_animation,
    seen_level:
      Number.isInteger(r.seen_level) && (r.seen_level as number) >= 0
        ? (r.seen_level as number)
        : DEFAULT_PREFS.seen_level,
    reading_pages_per_hour:
      Number.isInteger(r.reading_pages_per_hour) && (r.reading_pages_per_hour as number) > 0
        ? (r.reading_pages_per_hour as number)
        : DEFAULT_PREFS.reading_pages_per_hour,
  };
}

// The user's preferences: defaults at once, the saved file once it loads.
export class PrefsStore {
  private client: PrefsClient;

  prefs = $state<Prefs>({ ...DEFAULT_PREFS });
  ready = $state(false);
  error = $state("");

  constructor(client: PrefsClient = defaultClient) {
    this.client = client;
  }

  async hydrate(): Promise<void> {
    if (this.ready) return;
    try {
      this.prefs = normalize(await this.client.load());
    } catch (e) {
      this.error = errorMessage(e, "Failed to load your settings.");
    } finally {
      this.ready = true;
    }
  }

  // An import replaced the data underneath; read it again.
  async reload(): Promise<void> {
    this.ready = false;
    this.error = "";
    await this.hydrate();
  }

  async update(patch: PrefsPatch): Promise<void> {
    const before = this.prefs;
    this.error = "";
    this.prefs = { ...before, ...patch };
    try {
      this.prefs = normalize(await this.client.update(patch));
    } catch (e) {
      this.prefs = before;
      this.error = errorMessage(e, "Failed to save your settings.");
    }
  }
}

export const prefsStore = new PrefsStore();
