import { describe, expect, it } from "vitest";
import { sectionOf, shouldReveal } from "./navigation";

describe("sectionOf", () => {
  it.each([
    ["/", "home"],
    ["/library", "library"],
    ["/library/", "library"],
    ["/planner", "planner"],
    ["/profile", "profile"],
    ["/settings", "settings"],
  ])("%s belongs to %s", (path, section) => {
    expect(sectionOf(path, null)).toBe(section);
  });

  it("a detail page keeps the section you came from", () => {
    expect(sectionOf("/media/movie/1", "library")).toBe("library");
    expect(sectionOf("/media/anime/7", "planner")).toBe("planner");
  });

  it("a detail page opened cold belongs to home", () => {
    expect(sectionOf("/media/movie/1", null)).toBe("home");
  });

  it("a page outside the sections has none", () => {
    expect(sectionOf("/welcome", "library")).toBeNull();
  });
});

describe("shouldReveal", () => {
  const rail = { left: 0, right: 300 };

  it("asks for no scroll when the tab already sits inside the rail", () => {
    expect(shouldReveal(rail, { left: 10, right: 90 })).toBe(0);
  });

  it("scrolls right by the overhang when the tab runs past the end", () => {
    expect(shouldReveal(rail, { left: 280, right: 360 })).toBe(60);
  });

  it("scrolls left when the tab starts before the rail", () => {
    expect(shouldReveal(rail, { left: -40, right: 40 })).toBe(-40);
  });

  it("stays put when the tab exactly fills the rail", () => {
    expect(shouldReveal(rail, { left: 0, right: 300 })).toBe(0);
  });

  it("never scrolls a wide tab's left edge out of view to chase its right edge", () => {
    // The tab starts inside the rail but is wider than it: scrolling by the full overhang
    // would push the label's start off the left edge, so the move stops at the left edge.
    expect(shouldReveal(rail, { left: 20, right: 400 })).toBe(20);
  });
});
