import { invoke } from "@tauri-apps/api/core";
import type { Prefs, PrefsPatch } from "$lib/types/prefs";

function load(): Promise<Prefs> {
  return invoke<Prefs>("prefs_load");
}

function update(patch: PrefsPatch): Promise<Prefs> {
  return invoke<Prefs>("prefs_update", { patch });
}

export const prefs = { load, update };
export type PrefsClient = typeof prefs;
