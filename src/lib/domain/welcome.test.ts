import { describe, expect, it } from "vitest";
import {
  BEATS,
  beatAfter,
  beatBefore,
  firstBeat,
  isLastBeat,
  resumeBeat,
  shouldWelcome,
  type Beat,
} from "./welcome";

describe("welcome beats", () => {
  it("runs garden, keys, taste, planner in order", () => {
    expect(BEATS).toEqual(["garden", "keys", "taste", "planner"]);
  });

  it("starts at the first beat", () => {
    expect(firstBeat()).toBe("garden");
  });

  it("walks forward to the end and stops", () => {
    expect(beatAfter("garden")).toBe("keys");
    expect(beatAfter("keys")).toBe("taste");
    expect(beatAfter("taste")).toBe("planner");
    expect(beatAfter("planner")).toBe(null);
  });

  it("walks back and stops at the first", () => {
    expect(beatBefore("planner")).toBe("taste");
    expect(beatBefore("garden")).toBe(null);
  });

  it("knows the last beat", () => {
    expect(isLastBeat("planner")).toBe(true);
    expect(isLastBeat("taste")).toBe(false);
  });
});

describe("resumeBeat", () => {
  it("starts a fresh run at the first beat", () => {
    expect(resumeBeat(0)).toBe("garden");
  });

  it("returns to where the user stopped", () => {
    expect(resumeBeat(2)).toBe("taste");
  });

  it("clamps a stored beat past the end back to the last one", () => {
    expect(resumeBeat(99)).toBe("planner");
  });

  it("clamps a negative stored beat to the first", () => {
    expect(resumeBeat(-3)).toBe("garden");
  });
});

describe("shouldWelcome", () => {
  const fresh = { ready: true, welcomed: false, entries: 0 };

  it("greets a fresh install", () => {
    expect(shouldWelcome(fresh)).toBe(true);
  });

  it("waits until prefs are loaded, so it never flashes", () => {
    expect(shouldWelcome({ ...fresh, ready: false })).toBe(false);
  });

  it("never greets someone who has already been welcomed", () => {
    expect(shouldWelcome({ ...fresh, welcomed: true })).toBe(false);
  });

  it("never traps a user who already has a library", () => {
    expect(shouldWelcome({ ...fresh, entries: 7 })).toBe(false);
  });

  it("still skips a library owner who was never welcomed", () => {
    expect(shouldWelcome({ ready: true, welcomed: false, entries: 1 })).toBe(false);
  });
});

describe("beat index", () => {
  it("maps every beat to the number stored in prefs and back", () => {
    for (const [i, beat] of BEATS.entries()) {
      expect(resumeBeat(i)).toBe(beat as Beat);
    }
  });
});
