import { prefs as defaultClient, type PrefsClient } from "$lib/api/prefs";
import { DEFAULT_PREFS, THEMES, type Prefs, type PrefsPatch, type Theme } from "$lib/types/prefs";
import { errorMessage } from "$lib/utils/errors";

// Keeps only known fields with the right type; e2e fakes answer unknown commands with junk.
function normalize(raw: unknown): Prefs {
  const r = (raw ?? {}) as Partial<Record<keyof Prefs, unknown>>;
  return {
    motion: typeof r.motion === "boolean" ? r.motion : DEFAULT_PREFS.motion,
    seen_level:
      Number.isInteger(r.seen_level) && (r.seen_level as number) >= 0
        ? (r.seen_level as number)
        : DEFAULT_PREFS.seen_level,
    reading_pages_per_hour:
      Number.isInteger(r.reading_pages_per_hour) && (r.reading_pages_per_hour as number) > 0
        ? (r.reading_pages_per_hour as number)
        : DEFAULT_PREFS.reading_pages_per_hour,
    theme: THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : DEFAULT_PREFS.theme,
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

  // Resolves true only when the backend kept the change; `error` says why it did not.
  async update(patch: PrefsPatch): Promise<boolean> {
    const before = this.prefs;
    this.error = "";
    this.prefs = { ...before, ...patch };
    try {
      this.prefs = normalize(await this.client.update(patch));
      return true;
    } catch (e) {
      this.prefs = before;
      this.error = errorMessage(e, "Failed to save your settings.");
      return false;
    }
  }
}

export const prefsStore = new PrefsStore();
