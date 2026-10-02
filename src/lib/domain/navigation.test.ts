import { describe, expect, it } from "vitest";
import { sectionOf } from "./navigation";

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
