import { describe, expect, it } from "vitest";
import { dismissesSheet } from "./swipe";

describe("dismissesSheet", () => {
  it("closes past a quarter of the sheet's height", () => {
    expect(dismissesSheet(101, 400)).toBe(true);
  });
  it("stays open for a short or upward drag", () => {
    expect(dismissesSheet(99, 400)).toBe(false);
    expect(dismissesSheet(-200, 400)).toBe(false);
  });
  it("needs no more than a short swipe on a tall sheet", () => {
    expect(dismissesSheet(121, 800)).toBe(true);
    expect(dismissesSheet(119, 800)).toBe(false);
  });
  it("never closes a sheet with no height", () => {
    expect(dismissesSheet(50, 0)).toBe(false);
  });
});
