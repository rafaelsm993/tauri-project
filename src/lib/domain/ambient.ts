// One tempo for every ambient loop, so the tree and the background breathe together.
export const AMBIENT_BEAT_MS = 6000;

// A negative CSS delay that joins a loop at the shared beat's current point instead of restarting it.
export function beatDelay(now: number, beat = AMBIENT_BEAT_MS): string {
  const phase = Math.round(((now % beat) + beat) % beat);
  return phase === 0 ? "0ms" : `-${phase}ms`;
}

// Higher rows of the tree light first.
export function igniteOrder(y: number): number {
  return Math.round(y / 10);
}
