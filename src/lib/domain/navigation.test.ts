import { describe, expect, it } from "vitest";
import { collapseOnScroll, sectionOf, shouldReveal } from "./navigation";

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

describe("collapseOnScroll", () => {
  const at = (y: number, collapsed = false) => ({ y, collapsed });

  it("never collapses at the top of the page", () => {
    expect(collapseOnScroll(at(40, true), 0).collapsed).toBe(false);
  });

  it("collapses once a downward scroll passes the threshold", () => {
    expect(collapseOnScroll(at(100), 140).collapsed).toBe(true);
  });

  it("reveals again on any upward scroll past the threshold", () => {
    expect(collapseOnScroll(at(400, true), 360).collapsed).toBe(false);
  });

  it("ignores jitter smaller than the threshold", () => {
    // The wobble must not flip the state in EITHER direction: a few px down must not collapse
    // an expanded header, and a few px up must not reveal a collapsed one. (Pairing it the
    // other way round proves nothing — "keep the previous answer" and "decide afresh" agree
    // there, so the test would pass with the threshold removed entirely.)
    expect(collapseOnScroll(at(300, false), 304).collapsed).toBe(false);
    expect(collapseOnScroll(at(300, true), 296).collapsed).toBe(true);
  });

  it("reveals the header when a small scroll lands back at the top", () => {
    // The move is inside the jitter threshold, so only the top-of-page rule can decide this.
    expect(collapseOnScroll(at(4, true), 0).collapsed).toBe(false);
  });

  it("clamps the remembered position at the top", () => {
    expect(collapseOnScroll(at(200, true), -30).y).toBe(0);
  });

  it("remembers the position it was last asked about", () => {
    expect(collapseOnScroll(at(100), 140).y).toBe(140);
  });

  it("treats rubber-band overscroll as the top", () => {
    expect(collapseOnScroll(at(200, true), -30).collapsed).toBe(false);
  });
});

it("accumulates slow directional scroll and reverses without reacting to jitter", () => {
  let state: import("./navigation").HeaderScroll = { y: 0, collapsed: false };
  for (let y = 2; y <= 20; y += 2) state = collapseOnScroll(state, y);
  expect(state.collapsed).toBe(true);
  for (let y = 18; y >= 8; y -= 2) state = collapseOnScroll(state, y);
  expect(state.collapsed).toBe(false);
  for (let i = 0; i < 20; i++) {
    state = collapseOnScroll(state, 10);
    state = collapseOnScroll(state, 8);
  }
  expect(state.collapsed).toBe(false);
});
