// The rating star as a 15×15 pixel sprite, after Terraria's Fallen Star: pixels on the edge are the
// outline, a few in the upper left are the glint, the rest is the body.
export const STAR_SIZE = 15;

export const MASK = [
  ".......X.......",
  "......XXX......",
  "......XXX......",
  ".....XXXXX.....",
  ".....XXXXX.....",
  "XXXXXXXXXXXXXXX",
  ".XXXXXXXXXXXXX.",
  "..XXXXXXXXXXX..",
  "...XXXXXXXXX...",
  "....XXXXXXX....",
  "....XXXXXXX....",
  "...XXXXXXXXX...",
  "...XXXX.XXXX...",
  "..XXX.....XXX..",
  "..XX.......XX..",
] as const;

export type StarTone = "outline" | "body" | "glint";

const on = (x: number, y: number) => MASK[y]?.[x] === "X";

export function starPixels(): { x: number; y: number; tone: StarTone }[] {
  const pixels: { x: number; y: number; tone: StarTone }[] = [];
  MASK.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell !== "X") return;
      const edge = !on(x + 1, y) || !on(x - 1, y) || !on(x, y + 1) || !on(x, y - 1);
      const glint = !edge && x <= 7 && y <= 8 && x + y <= 11;
      pixels.push({ x, y, tone: edge ? "outline" : glint ? "glint" : "body" });
    }),
  );
  return pixels;
}

// One path per tone, each pixel a unit square, so the sprite stays sharp at any size.
export const STAR_PATHS: Record<StarTone, string> = (() => {
  const paths: Record<StarTone, string> = { outline: "", body: "", glint: "" };
  for (const p of starPixels()) paths[p.tone] += `M${p.x} ${p.y}h1v1h-1z`;
  return paths;
})();
