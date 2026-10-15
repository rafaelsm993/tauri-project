const THRESHOLD = 0.25;

// A downward drag on a bottom sheet closes it once it passes a quarter of its height.
export function dismissesSheet(dy: number, height: number): boolean {
  return height > 0 && dy > height * THRESHOLD;
}
