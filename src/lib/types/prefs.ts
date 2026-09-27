// Mirror of `Prefs` in src-tauri/src/prefs/mod.rs; guarded by prefs.contract.test.ts.
export interface Prefs {
  background_animation: boolean;
  // The last level the user was congratulated on; 0 until the first check adopts the current one.
  seen_level: number;
}

export type PrefsPatch = Partial<Prefs>;

export const DEFAULT_PREFS: Prefs = { background_animation: true, seen_level: 0 };
