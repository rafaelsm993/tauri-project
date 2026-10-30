export const BEATS = ["garden", "keys", "planner", "pace", "manual"] as const;
export type Beat = (typeof BEATS)[number];
const STORED: Record<Beat, number> = { garden: 0, keys: 1, planner: 3, pace: 4, manual: 5 };
export const beatIndex = (beat: Beat): number => STORED[beat];
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
export function resumeBeat(stored: number): Beat {
  const n = Number.isFinite(stored) ? Math.max(0, Math.trunc(stored)) : 0;
  if (n === 2) return "planner";
  return [...BEATS].reverse().find((b) => STORED[b] <= n) ?? firstBeat();
}
export function shouldWelcome(s: {
  ready: boolean;
  welcomed: boolean;
  entries: number;
  path: string;
}): boolean {
  return (s.path === "/" || s.path === "") && s.ready && !s.welcomed && s.entries === 0;
}
