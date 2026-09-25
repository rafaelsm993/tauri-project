import { isOfflineError } from "$lib/utils/errors";

// Offline when the browser says so or a network-backed call failed since the last success.
export class OnlineStore {
  private browserOnline = $state(true);
  private failed = $state(false);

  online = $derived(this.browserOnline && !this.failed);

  constructor(
    target: EventTarget | undefined = globalThis.window,
    initiallyOnline = globalThis.navigator?.onLine ?? true,
  ) {
    this.browserOnline = initiallyOnline;
    target?.addEventListener("offline", () => {
      this.browserOnline = false;
    });
    target?.addEventListener("online", () => {
      this.browserOnline = true;
      this.failed = false;
    });
  }

  noteFailure(e: unknown): void {
    if (isOfflineError(e)) this.failed = true;
  }

  noteSuccess(): void {
    this.failed = false;
  }
}

export const onlineStore = new OnlineStore();
