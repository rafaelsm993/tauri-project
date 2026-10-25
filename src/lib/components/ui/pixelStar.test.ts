import { describe, expect, it } from "vitest";
import { MASK, STAR_PATHS, STAR_SIZE, starPixels } from "./pixelStar";

describe("pixel star", () => {
  it("is a square, mirror-symmetric sprite", () => {
    expect(MASK).toHaveLength(STAR_SIZE);
    for (const row of MASK) {
      expect(row).toHaveLength(STAR_SIZE);
      expect(row).toBe([...row].reverse().join(""));
    }
  });

  it("outlines every pixel that touches the outside", () => {
    const pixels = starPixels();
    const on = new Set(pixels.map((p) => `${p.x},${p.y}`));
    for (const p of pixels) {
      const exposed = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => !on.has(`${p.x + dx},${p.y + dy}`));
      expect(p.tone === "outline").toBe(exposed);
    }
  });

  it("keeps the glint inside the upper-left", () => {
    const glint = starPixels().filter((p) => p.tone === "glint");
    expect(glint.length).toBeGreaterThan(4);
    for (const p of glint) expect(p.x + p.y).toBeLessThanOrEqual(11);
  });

  it("draws each tone as unit squares", () => {
    expect(STAR_PATHS.outline.startsWith("M7 0h1v1h-1z")).toBe(true);
    const squares = (d: string) => d.split("M").length - 1;
    const total =
      squares(STAR_PATHS.outline) + squares(STAR_PATHS.body) + squares(STAR_PATHS.glint);
    expect(total).toBe(MASK.join("").split("X").length - 1);
  });
});
