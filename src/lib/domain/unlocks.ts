// What levelling opens up. Keyed off `seen_level`, the highest level ever congratulated, so a
// level that later drops (an import, a merge) never takes a reward away (Q14).
export type UnlockKind = "accent" | "motif" | "pack" | "garden";

export type UnlockId =
  "bubbles" | "ember" | "embers" | "sway" | "dusk" | "aurora" | "sunrise" | "ocean" | "midnight";

export interface Unlock {
  id: UnlockId;
  kind: UnlockKind;
  level: number;
  label: string;
  // One line shown on the card, in the user's terms rather than the feature's.
  blurb: string;
}

// Rising level order: the UI renders this as a ladder and reads the first entry as "next".
export const UNLOCKS: readonly Unlock[] = [
  {
    id: "bubbles",
    kind: "motif",
    level: 2,
    label: "Bubbles",
    blurb: "The drifting background that started it all.",
  },
  {
    id: "ember",
    kind: "accent",
    level: 3,
    label: "Ember",
    blurb: "A warmer accent, closer to firelight.",
  },
  {
    id: "embers",
    kind: "motif",
    level: 5,
    label: "Embers",
    blurb: "Slow sparks instead of bubbles.",
  },
  {
    id: "sway",
    kind: "garden",
    level: 8,
    label: "Garden sway",
    blurb: "Your plants lean in a soft breeze.",
  },
  {
    id: "dusk",
    kind: "accent",
    level: 8,
    label: "Dusk",
    blurb: "A cooler accent for late evenings.",
  },
  {
    id: "aurora",
    kind: "motif",
    level: 12,
    label: "Aurora",
    blurb: "A slow ribbon of light behind everything.",
  },
  {
    id: "sunrise",
    kind: "pack",
    level: 16,
    label: "Sunrise",
    blurb: "A full palette that warms the whole app.",
  },
  {
    id: "ocean",
    kind: "accent",
    level: 20,
    label: "Ocean",
    blurb: "Deep blue, for the long haul.",
  },
  {
    id: "midnight",
    kind: "pack",
    level: 25,
    label: "Midnight",
    blurb: "The darkest palette, for night reading.",
  },
] as const;

const BY_ID = new Map(UNLOCKS.map((u) => [u.id, u]));

// Takes a plain string: the equipped id comes from prefs, where an unknown value is possible
// after a downgrade or a hand-edited file, and must simply read as not unlocked.
export function isUnlocked(id: string, seenLevel: number): boolean {
  const unlock = BY_ID.get(id as UnlockId);
  return unlock !== undefined && seenLevel >= unlock.level;
}

export function unlockedIds(seenLevel: number): UnlockId[] {
  return UNLOCKS.filter((u) => seenLevel >= u.level).map((u) => u.id);
}

// The nearest reward still ahead, for the "next up" line; null once everything is open.
export function nextUnlock(seenLevel: number): Unlock | null {
  return UNLOCKS.find((u) => u.level > seenLevel) ?? null;
}

const openOfKind = (kind: UnlockKind, seenLevel: number): Unlock[] =>
  UNLOCKS.filter((u) => u.kind === kind && seenLevel >= u.level);

export const accentsFor = (seenLevel: number): Unlock[] => openOfKind("accent", seenLevel);
export const motifsFor = (seenLevel: number): Unlock[] => openOfKind("motif", seenLevel);
export const packsFor = (seenLevel: number): Unlock[] => openOfKind("pack", seenLevel);
