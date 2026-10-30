import { describe, expect, it } from "vitest";
import {
  BEATS,
  beatAfter,
  beatBefore,
  beatIndex,
  resumeBeat,
  isLastBeat,
  shouldWelcome,
} from "./welcome";
it("skips taste but preserves old stored indexes", () => {
  expect(BEATS).toEqual(["garden", "keys", "planner", "pace", "manual"]);
  expect(beatAfter("keys")).toBe("planner");
  expect(beatBefore("planner")).toBe("keys");
  expect([0, 1, 2, 3, 4, 5, 99, -1].map(resumeBeat)).toEqual([
    "garden",
    "keys",
    "planner",
    "planner",
    "pace",
    "manual",
    "manual",
    "garden",
  ]);
  expect(BEATS.map(beatIndex)).toEqual([0, 1, 3, 4, 5]);
  for (const b of BEATS) expect(resumeBeat(beatIndex(b))).toBe(b);
  expect(isLastBeat("manual")).toBe(true);
  expect(beatAfter("manual")).toBeNull();
});

describe("shouldWelcome", () => {
  const fresh = { ready: true, welcomed: false, entries: 0, path: "/" };

  it("greets a fresh install", () => {
    expect(shouldWelcome(fresh)).toBe(true);
  });

  it("greets a fresh Linux Flatpak at tauri://localhost without a slash", () => {
    expect(shouldWelcome({ ...fresh, path: "" })).toBe(true);
  });

  it("does not interrupt a deep link", () => {
    expect(shouldWelcome({ ...fresh, path: "/settings" })).toBe(false);
    expect(shouldWelcome({ ...fresh, path: "/welcome" })).toBe(false);
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
    expect(shouldWelcome({ ...fresh, entries: 1 })).toBe(false);
  });
});
