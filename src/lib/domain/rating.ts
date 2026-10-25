// A rating is 1–10, drawn as five stars where each half star is one point.
export const RATING_WORDS = [
  "Awful",
  "Terrible",
  "Bad",
  "Poor",
  "Meh",
  "OK",
  "Good",
  "Great",
  "Amazing",
  "Masterpiece",
] as const;

export type StarFill = "full" | "half" | "empty";

export function ratingText(rating: number | null): string {
  return rating === null ? "Not rated" : `${rating} · ${RATING_WORDS[rating - 1]}`;
}

// Star `star` (0–4) covers points 2·star+1 (its left half) and 2·star+2.
export function starFill(rating: number | null, star: number): StarFill {
  const value = rating ?? 0;
  if (value >= 2 * star + 2) return "full";
  if (value === 2 * star + 1) return "half";
  return "empty";
}

// The half star under a point `x` px along stars `width` px wide; outside them, the nearest end.
export function ratingAt(x: number, width: number): number {
  if (width <= 0) return 1;
  return Math.min(10, Math.max(1, Math.ceil((x / width) * 10)));
}

// The value a key moves to: null clears, undefined means the key isn't ours.
export function ratingKey(rating: number | null, key: string): number | null | undefined {
  const clamp = (n: number) => Math.min(10, Math.max(1, n));
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return clamp((rating ?? 0) + 1);
    case "ArrowLeft":
    case "ArrowDown":
      return rating === null ? null : clamp(rating - 1);
    case "PageUp":
      return clamp((rating ?? 0) + 2);
    case "PageDown":
      return rating === null ? null : clamp(rating - 2);
    case "Home":
      return 1;
    case "End":
      return 10;
    case "Delete":
    case "Backspace":
      return null;
    default:
      return undefined;
  }
}
