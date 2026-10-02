// Mirror of `Prefs` in src-tauri/src/prefs/mod.rs; guarded by prefs.contract.test.ts.
export interface Prefs {
  // Every decorative animation: background, level-up burst, planner movement.
  motion: boolean;
  // The last level the user was congratulated on; 0 until the first check adopts the current one.
  seen_level: number;
  // Asked the first time a book is planned; null until then.
  reading_pages_per_hour: number | null;
  // The colour scheme; "system" follows the OS light/dark setting.
  theme: Theme;
}

export type Theme = "system" | "dark" | "light";

export const THEMES: readonly Theme[] = ["system", "dark", "light"];

export type PrefsPatch = Partial<Prefs>;

export const DEFAULT_PREFS: Prefs = {
  motion: true,
  seen_level: 0,
  reading_pages_per_hour: null,
  theme: "system",
};
