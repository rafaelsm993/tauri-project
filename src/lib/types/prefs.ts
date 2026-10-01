// Mirror of `Prefs` in src-tauri/src/prefs/mod.rs; guarded by prefs.contract.test.ts.
export interface Prefs {
  background_animation: boolean;
  // The last level the user was congratulated on; 0 until the first check adopts the current one.
  seen_level: number;
  // Asked the first time a book is planned; null until then.
  reading_pages_per_hour: number | null;
}

export type PrefsPatch = Partial<Prefs>;

export const DEFAULT_PREFS: Prefs = {
  background_animation: true,
  seen_level: 0,
  reading_pages_per_hour: null,
};
