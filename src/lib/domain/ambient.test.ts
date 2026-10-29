import { describe, expect, it } from "vitest";
import { AMBIENT_BEAT_MS, beatDelay, igniteOrder } from "./ambient";

describe("beatDelay", () => {
  it("is a negative delay to the current point of the shared beat", () => {
    expect(beatDelay(0)).toBe("0ms");
    expect(beatDelay(1500)).toBe("-1500ms");
    expect(beatDelay(AMBIENT_BEAT_MS + 250)).toBe("-250ms");
  });

  it("gives two mounts at the same moment the same phase", () => {
    expect(beatDelay(12_345)).toBe(beatDelay(12_345 + AMBIENT_BEAT_MS * 3));
  });

  it("never returns a positive delay, even for odd clocks", () => {
    expect(beatDelay(-100)).toBe(`-${AMBIENT_BEAT_MS - 100}ms`);
  });
});

describe("igniteOrder", () => {
  it("lights higher rows first, one step per tenth of the map", () => {
    expect(igniteOrder(5)).toBe(1);
    expect(igniteOrder(20)).toBe(2);
    expect(igniteOrder(96)).toBe(10);
  });
});
