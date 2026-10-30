import { describe, expect, it } from "vitest";
import { displayedTitle, earnedTitles, renamedTitle } from "./titles";

describe("earnedTitles", () => {
  it("lists only the existing titles earned at the current level", () => {
    expect(earnedTitles(3)).toEqual([
      { level: 1, name: "Newcomer" },
      { level: 3, name: "Curious Mind" },
    ]);
    expect(earnedTitles(2)).toEqual([{ level: 1, name: "Newcomer" }]);
  });
});

describe("displayedTitle", () => {
  it("uses the latest currently earned title for Automatic", () => {
    expect(displayedTitle(8, "automatic")).toEqual({
      name: "Enthusiast",
      next: { name: "Connoisseur", level: 12 },
    });
  });

  it("keeps an older earned selection without changing the next progression title", () => {
    expect(displayedTitle(12, "Curious Mind")).toEqual({
      name: "Curious Mind",
      next: { name: "Devotee", level: 16 },
    });
  });

  it.each(["unknown", "curious mind", "", "SESH Eternal"])(
    "falls back safely for %j at level eight",
    (selected) => {
      expect(displayedTitle(8, selected)).toEqual({
        name: "Enthusiast",
        next: { name: "Connoisseur", level: 12 },
      });
    },
  );

  it("relocks a selected title on level loss and restores it when re-earned", () => {
    const selected = "Connoisseur";
    expect(displayedTitle(12, selected).name).toBe(selected);
    expect(displayedTitle(8, selected).name).toBe("Enthusiast");
    expect(displayedTitle(12, selected).name).toBe(selected);
  });

  it("does not invent another title after the last catalogue tier", () => {
    expect(displayedTitle(200, "automatic")).toEqual({ name: "SESH Eternal", next: null });
    expect(displayedTitle(200, "Newcomer")).toEqual({ name: "Newcomer", next: null });
  });

  it("starts with Newcomer and the existing next title", () => {
    expect(displayedTitle(1, "automatic")).toEqual({
      name: "Newcomer",
      next: { name: "Curious Mind", level: 3 },
    });
  });
});

describe("renamedTitle", () => {
  it("maps the title that carried the old app name", () => {
    expect(renamedTitle("Aevum Eternal")).toBe("SESH Eternal");
  });

  it.each(["automatic", "Curious Mind", "SESH Eternal", ""])("keeps %j", (title) => {
    expect(renamedTitle(title)).toBe(title);
  });
});
