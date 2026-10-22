// The first-run story, in order. Each beat is one screen the user can skip from.
export const BEATS = ["garden", "keys", "taste", "planner"] as const;

export type Beat = (typeof BEATS)[number];

export function firstBeat(): Beat {
  return BEATS[0];
}

export function beatAfter(beat: Beat): Beat | null {
  return BEATS[BEATS.indexOf(beat) + 1] ?? null;
}

export function beatBefore(beat: Beat): Beat | null {
  const i = BEATS.indexOf(beat);
  return i > 0 ? BEATS[i - 1] : null;
}

export function isLastBeat(beat: Beat): boolean {
  return beat === BEATS[BEATS.length - 1];
}

// A stored beat survives a quit mid-welcome; anything out of range lands inside it.
export function resumeBeat(stored: number): Beat {
  const i = Math.min(Math.max(Math.trunc(stored), 0), BEATS.length - 1);
  return BEATS[i];
}

// Only a loaded, never-welcomed, empty install is greeted; a library owner is never trapped.
export function shouldWelcome(s: { ready: boolean; welcomed: boolean; entries: number }): boolean {
  return s.ready && !s.welcomed && s.entries === 0;
}
