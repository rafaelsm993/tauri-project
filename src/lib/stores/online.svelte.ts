import { untrack } from "svelte";
import { isOfflineError } from "$lib/utils/errors";

// Offline when the browser says so or the backend last failed to reach the network.
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

  noteNetwork(online: boolean): void {
    this.failed = !online;
  }
}

export const onlineStore = new OnlineStore();

// Runs `fn` on each offline → online transition; call during component setup.
export function onReconnect(fn: () => void, store: OnlineStore = onlineStore): void {
  let wasOnline = untrack(() => store.online);
  $effect(() => {
    const online = store.online;
    if (online && !wasOnline) untrack(fn);
    wasOnline = online;
  });
}
