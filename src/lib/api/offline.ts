import { listen } from "@tauri-apps/api/event";
import { onlineStore, type OnlineStore } from "$lib/stores/online.svelte";
import { isOfflineError, OFFLINE_PREFIX } from "$lib/utils/errors";

export { isOfflineError, OFFLINE_PREFIX };

// Mirrors NETWORK_EVENT in src-tauri/src/api/http.rs.
export const NETWORK_EVENT = "network";

// A resolved call may be a stale disk-cache answer, so only failures are reported here.
export async function report<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    onlineStore.noteFailure(e);
    throw e;
  }
}

// Follows the backend's view of the network; resolves to its unsubscribe.
export async function watchNetwork(store: OnlineStore = onlineStore): Promise<() => void> {
  try {
    return await listen<{ online: boolean }>(NETWORK_EVENT, (e) =>
      store.noteNetwork(e.payload.online),
    );
  } catch (e) {
    console.warn("network events unavailable:", e);
    return () => {};
  }
}
