import { describe, expect, it } from "vitest";
import { BASE_PROFILE_ART, PROFILE_ART, artworkPaths } from "./profileArt";
import { completionAchievements, COMPLETION_TYPES } from "./completionAchievements";

describe("baseline profile artwork", () => {
  it("provides all thirty shared requirements with unique ornamental artwork at both sizes", () => {
    expect(PROFILE_ART).toHaveLength(30);
    expect(
      PROFILE_ART.map(({ id, type, name, tier, required, level }) => ({
        id,
        type,
        name,
        tier,
        required,
        level,
      })),
    ).toEqual(
      completionAchievements([], 0).map(({ id, type, name, tier, required, level }) => ({
        id,
        type,
        name,
        tier,
        required,
        level,
      })),
    );
    expect(new Set(PROFILE_ART.map((art) => art.id)).size).toBe(30);
    for (const size of [24, 32] as const) {
      expect(new Set(PROFILE_ART.map((art) => art.pixels[size].join("\n"))).size).toBe(30);
      for (const art of PROFILE_ART) {
        expect(art.pixels[size]).toHaveLength(size);
        expect(
          art.pixels[size].every((row) => row.length === size && /^[.osbag]+$/.test(row)),
        ).toBe(true);
      }
    }
  });
  it.each(["default", "unknown:1", "movie:3", "movie:01", ""])(
    "does not render missing baseline artwork %s",
    (id) => {
      expect(artworkPaths(id, 24)).toEqual([]);
      expect(artworkPaths(id, 32)).toEqual([]);
    },
  );

  it("encodes every occupied native pixel once, without curves or fractional geometry", () => {
    for (const art of PROFILE_ART) {
      for (const size of [24, 32] as const) {
        const paths = artworkPaths(art.id, size);
        expect(paths.map((path) => path.tone)).toEqual([
          "outline",
          "shade",
          "body",
          "accent",
          "glint",
        ]);
        const cells = new Map<string, string>();
        for (const { tone, d } of paths) {
          const squares = [...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)];
          expect(squares.map((match) => match[0]).join("")).toBe(d);
          for (const [, x, y] of squares) {
            expect(cells.has(`${x},${y}`)).toBe(false);
            cells.set(`${x},${y}`, tone);
          }
        }
        const tones = { o: "outline", s: "shade", b: "body", a: "accent", g: "glint" };
        const expected = new Map<string, string>();
        art.pixels[size].forEach((row, y) =>
          [...row].forEach((cell, x) => {
            if (cell !== ".") expected.set(`${x},${y}`, tones[cell as keyof typeof tones]);
          }),
        );
        expect(cells).toEqual(expected);
        expect(artworkPaths(art.id, size)).toBe(paths);
      }
    }
  });
  it("uses the six existing first-completion reward identities and names", () => {
    expect(BASE_PROFILE_ART.map(({ id, type, name }) => ({ id, type, name }))).toEqual(
      completionAchievements([], 0)
        .filter((reward) => reward.tier === 1)
        .map(({ id, type, name }) => ({ id, type, name })),
    );
    expect(BASE_PROFILE_ART.map((art) => art.type)).toEqual(COMPLETION_TYPES);
  });

  for (const size of [24, 32] as const) {
    it.each(COMPLETION_TYPES)(
      `draws %s on a native ${size}px grid with distinct tone clusters`,
      (type) => {
        const art = BASE_PROFILE_ART.find((art) => art.type === type)!;
        const rows = art.pixels[size];
        expect(rows).toHaveLength(size);
        expect(rows.every((row) => row.length === size && /^[.osbag]+$/.test(row))).toBe(true);
        for (const tone of "osbag") expect(rows.join("")).toContain(tone);
        expect(rows[0]).toBe(".".repeat(size));
        expect(rows.at(-1)).toBe(".".repeat(size));
      },
    );

    it(`gives all six silhouettes different native ${size}px artwork`, () => {
      expect(new Set(BASE_PROFILE_ART.map((art) => art.pixels[size].join("\n"))).size).toBe(6);
    });
  }
});
