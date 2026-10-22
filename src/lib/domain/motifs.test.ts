import { describe, expect, it } from "vitest";
import { MOTIFS, MAX_PARTICLES, motifById, particlesFor } from "./motifs";

describe("the motif registry", () => {
  it("has an entry for every motif on the unlock ladder", async () => {
    const { UNLOCKS } = await import("./unlocks");
    for (const u of UNLOCKS.filter((x) => x.kind === "motif" && x.id !== "sway")) {
      expect(MOTIFS[u.id], `no motif art for ${u.id}`).toBeDefined();
    }
  });

  it("names every motif and gives it a keyframe", () => {
    for (const motif of Object.values(MOTIFS)) {
      expect(motif.label.length).toBeGreaterThan(0);
      expect(motif.keyframe.length).toBeGreaterThan(0);
    }
  });

  it("caps the particle count at 20, the old hard-coded number", () => {
    expect(MAX_PARTICLES).toBe(20);
  });

  it("treats an unknown id as no motif rather than throwing", () => {
    expect(motifById("nonsense")).toBe(null);
  });
});

describe("particlesFor", () => {
  it("gives nothing when no motif is equipped", () => {
    expect(particlesFor("default", 12)).toEqual([]);
  });

  it("gives nothing when the count is zero", () => {
    expect(particlesFor("bubbles", 0)).toEqual([]);
  });

  it("gives exactly the asked-for count", () => {
    expect(particlesFor("bubbles", 7)).toHaveLength(7);
  });

  it("never exceeds the cap, however high the count asked", () => {
    expect(particlesFor("bubbles", 500)).toHaveLength(MAX_PARTICLES);
  });

  it("treats a negative count as none and floors a fractional one", () => {
    expect(particlesFor("bubbles", -3)).toEqual([]);
    expect(particlesFor("bubbles", 2.5)).toHaveLength(2);
  });

  it("is deterministic: the same request twice gives the same particles", () => {
    expect(particlesFor("bubbles", 12)).toEqual(particlesFor("bubbles", 12));
  });

  it("is stable under growth: raising the count keeps the existing particles put", () => {
    const small = particlesFor("bubbles", 5);
    const large = particlesFor("bubbles", 9);
    expect(large.slice(0, 5)).toEqual(small);
  });

  it("gives each motif its own look, not the same numbers twice", () => {
    expect(particlesFor("bubbles", 8)).not.toEqual(particlesFor("embers", 8));
  });

  it("puts each motif's particles in different places, not just different sizes", () => {
    const lefts = (id: string) => particlesFor(id, 8).map((p) => p.left);
    expect(lefts("bubbles")).not.toEqual(lefts("embers"));
  });

  it("varies the fields independently instead of driving them all off one number", () => {
    // One shared seed would make size a monotonic function of left: a mechanical-looking scene.
    const byLeft = [...particlesFor("bubbles", MAX_PARTICLES)].sort((a, b) => a.left - b.left);
    const climbing = byLeft.every((p, i) => i === 0 || p.size >= byLeft[i - 1].size);
    expect(climbing).toBe(false);
  });

  it("spreads particles across the width instead of stacking them in one place", () => {
    const lefts = new Set(particlesFor("bubbles", MAX_PARTICLES).map((p) => p.left));
    expect(lefts.size).toBeGreaterThan(MAX_PARTICLES / 2);
  });

  it("keeps every particle on screen and sanely sized", () => {
    for (const id of Object.keys(MOTIFS)) {
      for (const p of particlesFor(id, MAX_PARTICLES)) {
        expect(p.left).toBeGreaterThanOrEqual(0);
        expect(p.left).toBeLessThanOrEqual(100);
        expect(p.size).toBeGreaterThan(0);
        expect(p.size).toBeLessThanOrEqual(120);
        expect(p.duration).toBeGreaterThan(0);
        expect(p.delay).toBeGreaterThanOrEqual(0);
        expect(p.opacity).toBeGreaterThan(0);
        expect(p.opacity).toBeLessThanOrEqual(1);
      }
    }
  });
});
