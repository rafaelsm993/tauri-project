// Rewards require the current level; celebration history never grants eligibility.
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
    label: "Runic shimmer",
    blurb: "A brief light reveals the tree runes, then rests.",
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
export function isUnlocked(id: string, currentLevel: number, kind?: UnlockKind): boolean {
  const unlock = BY_ID.get(id as UnlockId);
  return (
    unlock !== undefined &&
    currentLevel >= unlock.level &&
    (kind === undefined || unlock.kind === kind)
  );
}

export function unlockedIds(currentLevel: number): UnlockId[] {
  return UNLOCKS.filter((u) => currentLevel >= u.level).map((u) => u.id);
}

// The nearest reward still ahead, for the "next up" line; null once everything is open.
export function nextUnlock(currentLevel: number): Unlock | null {
  return UNLOCKS.find((u) => u.level > currentLevel) ?? null;
}

const openOfKind = (kind: UnlockKind, currentLevel: number): Unlock[] =>
  UNLOCKS.filter((u) => u.kind === kind && currentLevel >= u.level);

export const accentsFor = (currentLevel: number): Unlock[] => openOfKind("accent", currentLevel);
export const motifsFor = (currentLevel: number): Unlock[] => openOfKind("motif", currentLevel);
export const packsFor = (currentLevel: number): Unlock[] => openOfKind("pack", currentLevel);
