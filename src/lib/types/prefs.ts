// Mirror of `Prefs` in src-tauri/src/prefs/mod.rs; guarded by prefs.contract.test.ts.
export interface Prefs {
  background_animation: boolean;
}

export type PrefsPatch = Partial<Prefs>;

export const DEFAULT_PREFS: Prefs = { background_animation: true };
