import { invoke } from "@tauri-apps/api/core";

// Which provider a key belongs to.
export type Keyed = "tmdb" | "rawg";

// Whether a key is set; the key itself never reaches the frontend.
export type KeyPresence = { tmdb: boolean; rawg: boolean };

function status(): Promise<KeyPresence> {
  return invoke<KeyPresence>("keys_status");
}

function set(which: Keyed, key: string): Promise<KeyPresence> {
  return invoke<KeyPresence>("keys_set", { which, key });
}

function clear(which: Keyed): Promise<KeyPresence> {
  return invoke<KeyPresence>("keys_clear", { which });
}

// Resolves when the provider accepts the key; rejects with a reason to show.
function check(which: Keyed, key: string): Promise<void> {
  return invoke<void>("keys_check", { which, key });
}

export const keys = { status, set, clear, check };
export type KeysClient = typeof keys;
