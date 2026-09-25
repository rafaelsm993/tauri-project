import { describe, expect, it } from "vitest";
import { placeBelow } from "./popover";

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

describe("placeBelow", () => {
  it("right-aligns the panel under the trigger", () => {
    expect(placeBelow(rect(900, 10, 40, 40), 200, { width: 1280, height: 800 })).toEqual({
      left: 740,
      top: 56,
      maxHeight: 736,
    });
  });

  it("never lets the panel leave the left or right edge", () => {
    expect(placeBelow(rect(0, 10, 40, 40), 200, { width: 360, height: 740 }).left).toBe(8);
    expect(placeBelow(rect(330, 10, 40, 40), 400, { width: 360, height: 740 }).left).toBe(8);
  });

  it("keeps a usable height near the bottom", () => {
    expect(placeBelow(rect(100, 700, 40, 30), 200, { width: 360, height: 740 }).maxHeight).toBe(
      160,
    );
  });
});
