import { describe, expect, it } from "vitest";
import { SAMPLE_GARDEN } from "./sampleGarden";
import { FAMILIES, familyOf } from "./dashboard";
import { scene, stageOf, type Stage } from "./garden";

describe("SAMPLE_GARDEN", () => {
  it("fits the narrowest supported row, so the bed never wraps to a lonely plant", () => {
    // 360 px minus the page shell and the card padding leaves room for five 52 px tracks.
    expect(SAMPLE_GARDEN.length).toBeLessThanOrEqual(5);
  });

  it("shows every stage, so the story is not told with half a garden", () => {
    const stages = new Set<Stage>(SAMPLE_GARDEN.map(stageOf));
    expect([...stages].sort()).toEqual(["bloom", "dormant", "seed", "sprout"]);
  });

  it("shows every family once", () => {
    const families = SAMPLE_GARDEN.map((e) => familyOf(e.snapshot.media_type));
    expect(new Set(families).size).toBe(FAMILIES.length);
  });

  it("grows a full scene with nothing held back", () => {
    const grown = scene(SAMPLE_GARDEN);
    expect(grown.plants).toHaveLength(SAMPLE_GARDEN.length);
    expect(grown.more).toBe(0);
  });

  it("belongs to nobody: its keys cannot collide with a real provider item", () => {
    for (const entry of SAMPLE_GARDEN) expect(entry.key.startsWith("sample:")).toBe(true);
  });

  it("is the same garden every time it is shown", () => {
    const first = scene(SAMPLE_GARDEN).plants.map((p) => `${p.key}:${p.growth}:${p.stage}`);
    const second = scene(SAMPLE_GARDEN).plants.map((p) => `${p.key}:${p.growth}:${p.stage}`);
    expect(first).toEqual(second);
  });
});
