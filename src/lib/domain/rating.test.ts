import { describe, expect, it } from "vitest";
import { RATING_WORDS, ratingAt, ratingKey, ratingText, starFill } from "./rating";

describe("ratingText", () => {
  it("is the number and its word, or Not rated", () => {
    expect(ratingText(8)).toBe("8 · Great");
    expect(ratingText(1)).toBe("1 · Awful");
    expect(ratingText(10)).toBe("10 · Masterpiece");
    expect(ratingText(null)).toBe("Not rated");
    expect(RATING_WORDS).toHaveLength(10);
  });
});

describe("starFill", () => {
  const fills = (r: number | null) => [0, 1, 2, 3, 4].map((i) => starFill(r, i));
  it("fills two points per star, the odd point as a half", () => {
    expect(fills(8)).toEqual(["full", "full", "full", "full", "empty"]);
    expect(fills(7)).toEqual(["full", "full", "full", "half", "empty"]);
    expect(fills(1)).toEqual(["half", "empty", "empty", "empty", "empty"]);
    expect(fills(10)).toEqual(["full", "full", "full", "full", "full"]);
    expect(fills(null)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
  });
});

describe("ratingAt", () => {
  it("maps a point along the stars to the half star under it", () => {
    expect(ratingAt(0, 170)).toBe(1);
    expect(ratingAt(8, 170)).toBe(1);
    expect(ratingAt(17, 170)).toBe(1);
    expect(ratingAt(18, 170)).toBe(2);
    expect(ratingAt(110, 170)).toBe(7);
    expect(ratingAt(170, 170)).toBe(10);
  });

  it("stays within 1–10 when the pointer leaves the stars", () => {
    expect(ratingAt(-40, 170)).toBe(1);
    expect(ratingAt(400, 170)).toBe(10);
    expect(ratingAt(50, 0)).toBe(1);
  });
});

describe("ratingKey", () => {
  it("steps by a point, a star, or to either end", () => {
    expect(ratingKey(7, "ArrowRight")).toBe(8);
    expect(ratingKey(7, "ArrowUp")).toBe(8);
    expect(ratingKey(7, "ArrowLeft")).toBe(6);
    expect(ratingKey(7, "ArrowDown")).toBe(6);
    expect(ratingKey(7, "PageUp")).toBe(9);
    expect(ratingKey(7, "PageDown")).toBe(5);
    expect(ratingKey(7, "Home")).toBe(1);
    expect(ratingKey(7, "End")).toBe(10);
  });

  it("never leaves 1–10, starts at 1 from unrated, and clears on Delete", () => {
    expect(ratingKey(10, "ArrowRight")).toBe(10);
    expect(ratingKey(10, "PageUp")).toBe(10);
    expect(ratingKey(1, "ArrowLeft")).toBe(1);
    expect(ratingKey(2, "PageDown")).toBe(1);
    expect(ratingKey(null, "ArrowRight")).toBe(1);
    expect(ratingKey(null, "ArrowLeft")).toBeNull();
    expect(ratingKey(7, "Delete")).toBeNull();
    expect(ratingKey(7, "Backspace")).toBeNull();
  });

  it("ignores other keys", () => {
    expect(ratingKey(7, "a")).toBeUndefined();
    expect(ratingKey(7, "Tab")).toBeUndefined();
  });
});
