import type { Theme } from "$lib/types/prefs";

// Read by static/theme-boot.js before the app starts, so a launch paints the last theme at once.
export const THEME_KEY = "aevum.theme";

const PREFERS_LIGHT = "(prefers-color-scheme: light)";

// Exposed by MainActivity.kt on Android only; true draws dark status and navigation bar icons.
type SystemBars = { setLightBars(light: boolean): void };

let current: Theme = "system";
let watching = false;

function prefersLight(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(PREFERS_LIGHT).matches;
}

function syncSystemBars(): void {
  const bars = (window as unknown as { AevumSystemBars?: SystemBars }).AevumSystemBars;
  if (!bars) return;
  bars.setLightBars(current === "light" || (current === "system" && prefersLight()));
  if (!watching && typeof window.matchMedia === "function") {
    window.matchMedia(PREFERS_LIGHT).addEventListener("change", syncSystemBars);
    watching = true;
  }
}

function remember(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

// global.css keys its palettes off `data-theme`; `color-scheme` recolours native controls.
// Storage can be off; prefs stay the source of truth, so a failed write is ignored.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "system" ? "light dark" : theme;
  current = theme;
  remember(theme);
  syncSystemBars();
}
