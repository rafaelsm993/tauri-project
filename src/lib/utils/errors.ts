// Rust prefixes network-class failures with this; mirrors `http::OFFLINE_PREFIX`.
export const OFFLINE_PREFIX = "offline: ";

function rawMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "";
}

export function isOfflineError(e: unknown): boolean {
  return rawMessage(e).startsWith(OFFLINE_PREFIX);
}

// Normalizes Tauri string rejections and Error objects into one message.
export function errorMessage(e: unknown, fallback: string): string {
  const message = rawMessage(e);
  const shown = message.startsWith(OFFLINE_PREFIX) ? message.slice(OFFLINE_PREFIX.length) : message;
  return shown || fallback;
}
