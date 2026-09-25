import { debug, error, info, warn } from "@tauri-apps/plugin-log";

type Level = "log" | "debug" | "info" | "warn" | "error";
type ConsoleFn = (...args: unknown[]) => void;

const LEVELS: Level[] = ["log", "debug", "info", "warn", "error"];

// console.log goes at debug so it passes the dev-build default level.
const SINKS: Record<Level, (message: string) => Promise<void>> = {
  log: debug,
  debug,
  info,
  warn,
  error,
};

export function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Mirrors console.* into tauri-plugin-log; no-op outside Tauri; returns a restore fn.
export function forwardConsole(): () => void {
  if (!inTauri()) return () => {};

  const originals = {} as Record<Level, ConsoleFn>;
  for (const level of LEVELS) {
    const original = console[level] as ConsoleFn;
    originals[level] = original;
    console[level] = (...args: unknown[]) => {
      original.apply(console, args);
      SINKS[level](format(args)).catch(() => {});
    };
  }

  return () => {
    for (const level of LEVELS) {
      console[level] = originals[level];
    }
  };
}

// Sends every Content-Security-Policy block to the app log; returns a stop fn.
export function reportCspViolations(): () => void {
  if (!inTauri()) return () => {};
  const onViolation = (e: SecurityPolicyViolationEvent) => {
    warn(`[csp] blocked ${e.violatedDirective} ${e.blockedURI}`).catch(() => {});
  };
  document.addEventListener("securitypolicyviolation", onViolation);
  return () => document.removeEventListener("securitypolicyviolation", onViolation);
}
