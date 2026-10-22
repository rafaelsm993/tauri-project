import { familyOf, type Family } from "./dashboard";
import { detailPath } from "./libraryView";
import { resolveTotal } from "./length";
import { percent } from "./progress";
import { STATUS_LABELS } from "$lib/stores/library.svelte";
import { MEDIA_LABELS, type MediaType } from "$lib/types/media";
import type { LibraryEntry } from "$lib/types/library";

// How the library is shown: the poster grid or the garden (GOALS §6.2).
export type LibraryViewMode = "grid" | "garden";

// How grown one item looks: planning → in progress → completed, dropped rests apart (GOALS §5.3).
export type Stage = "seed" | "sprout" | "bloom" | "dormant";

export interface Plant {
  key: string;
  // Route id for the item's page, from the same split as the grid cards.
  id: string;
  title: string;
  type: MediaType;
  family: Family;
  stage: Stage;
  // 0..1 along the stage, so a sprout shows how far the item got.
  growth: number;
  tilt: number;
  height: number;
  label: string;
}

export interface Scene {
  plants: Plant[];
  // Items past the cap, shown as a line that opens the grid.
  more: number;
}

// The Library view toggle; grid first, so nothing about the default screen changes.
export const VIEW_OPTIONS: { value: LibraryViewMode; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "garden", label: "Garden" },
];

// Plants drawn at once; past this the scene stops being readable at 360 px.
export const SCENE_CAP = 120;

const STAGES: Record<LibraryEntry["user"]["status"], Stage> = {
  planning: "seed",
  in_progress: "sprout",
  completed: "bloom",
  dropped: "dormant",
};

// A started item without a known length still has to look alive.
const UNKNOWN_GROWTH = 0.45;

export const stageOf = (entry: LibraryEntry): Stage => STAGES[entry.user.status];

export function growth(entry: LibraryEntry): number {
  const stage = stageOf(entry);
  if (stage === "bloom") return 1;
  if (stage !== "sprout") return 0;
  const { progress } = entry.user;
  if (progress <= 0) return 0;
  // `percent` already caps at 100, so a sprout never overgrows its bloom.
  const done = percent(progress, resolveTotal(entry.snapshot.media_type, null, entry.user.length));
  return done === null ? UNKNOWN_GROWTH : done / 100;
}

// FNV-1a, so a key always lands in the same spot and the scene never reshuffles.
export function seedOf(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Two independent spreads out of one hash.
const spread = (seed: number, shift: number, steps: number): number => (seed >>> shift) % steps;

export function plantOf(entry: LibraryEntry): Plant {
  const type = entry.snapshot.media_type;
  const seed = seedOf(entry.key);
  return {
    key: entry.key,
    id: detailPath(entry).id,
    title: entry.snapshot.title,
    type,
    family: familyOf(type),
    stage: stageOf(entry),
    growth: growth(entry),
    tilt: spread(seed, 0, 13) - 6,
    height: 0.85 + spread(seed, 8, 7) * 0.05,
    label: `${entry.snapshot.title}, ${MEDIA_LABELS[type].toLowerCase()}, ${STATUS_LABELS[
      entry.user.status
    ].toLowerCase()}`,
  };
}

export function scene(entries: LibraryEntry[], cap = SCENE_CAP): Scene {
  const newest = [...entries].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return {
    plants: newest.slice(0, cap).map(plantOf),
    more: Math.max(0, newest.length - cap),
  };
}
