import { onlineStore } from "$lib/stores/online.svelte";
import { isOfflineError, OFFLINE_PREFIX } from "$lib/utils/errors";

export { isOfflineError, OFFLINE_PREFIX };

// Feeds every network-backed invoke's outcome to the app-wide online state.
export async function report<T>(p: Promise<T>): Promise<T> {
  try {
    const value = await p;
    onlineStore.noteSuccess();
    return value;
  } catch (e) {
    onlineStore.noteFailure(e);
    throw e;
  }
}
