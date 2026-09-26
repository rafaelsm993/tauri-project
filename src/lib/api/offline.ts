import { invoke } from "@tauri-apps/api/core";
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

export const CONNECTIVITY_INTERVAL_MS = 30_000;

// Asks the backend to reach the network, for screens that make no provider calls.
export async function checkNetwork(store: OnlineStore = onlineStore): Promise<void> {
  try {
    store.noteNetwork(await invoke<boolean>("network_check"));
  } catch (e) {
    console.warn("network check unavailable:", e);
  }
}

// Runs `check` on an interval and on window focus; returns the stop function.
export function watchConnectivity(
  check: () => void,
  target: EventTarget = window,
  intervalMs = CONNECTIVITY_INTERVAL_MS,
): () => void {
  const timer = setInterval(check, intervalMs);
  target.addEventListener("focus", check);
  return () => {
    clearInterval(timer);
    target.removeEventListener("focus", check);
  };
}
