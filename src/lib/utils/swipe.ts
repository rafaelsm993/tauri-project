const THRESHOLD = 0.25;
const MAX_PX = 120;

// A downward drag closes a bottom sheet past a quarter of its height, or 120 px on a tall one.
export function dismissesSheet(dy: number, height: number): boolean {
  return height > 0 && dy > Math.min(height * THRESHOLD, MAX_PX);
}
