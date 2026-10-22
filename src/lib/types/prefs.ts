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
  // The first run is over: shown once, then never again unless replayed from settings.
  welcomed: boolean;
  // Which beat a half-finished welcome stopped on, so quitting mid-run resumes there.
  welcome_beat: number;
  // Picked during the welcome; seeds the first discover pages, empty when skipped.
  taste_families: string[];
  taste_genres: string[];
  accent: string;
  pack: string;
  motif: string;
}

export type Theme = "system" | "dark" | "light";

export const THEMES: readonly Theme[] = ["system", "dark", "light"];

export type PrefsPatch = Partial<Prefs>;

export const DEFAULT_PREFS: Prefs = {
  motion: true,
  seen_level: 0,
  reading_pages_per_hour: null,
  theme: "system",
  welcomed: false,
  welcome_beat: 0,
  taste_families: [],
  taste_genres: [],
  accent: "default",
  pack: "default",
  motif: "default",
};
