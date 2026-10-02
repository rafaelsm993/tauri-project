import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import AppNav from "./AppNav.svelte";
import LevelChip from "./LevelChip.svelte";

const LEVEL_3 = { level: 3, xp: 305, into: 45, needed: 141, fraction: 0.32 };

describe("AppNav", () => {
  it("is the main navigation with the five sections in order", () => {
    render(AppNav, { section: "home" });
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => [a.textContent?.trim(), a.getAttribute("href")])).toEqual([
      ["Home", "/"],
      ["Library", "/library"],
      ["Planner", "/planner"],
      ["Profile", "/profile"],
      ["Settings", "/settings"],
    ]);
  });

  it("marks only the current section", () => {
    render(AppNav, { section: "library" });
    const current = screen.getAllByRole("link").filter((a) => a.hasAttribute("aria-current"));
    expect(current.map((a) => a.textContent?.trim())).toEqual(["Library"]);
    expect(current[0]).toHaveAttribute("aria-current", "page");
  });

  it("marks nothing outside the sections", () => {
    render(AppNav, { section: null });
    expect(screen.getAllByRole("link").some((a) => a.hasAttribute("aria-current"))).toBe(false);
  });

  it("puts the level on the Profile tab once it is known", () => {
    render(AppNav, { section: "home", progress: { level: LEVEL_3, title: "Curious Mind" } });
    expect(screen.getByRole("link", { name: "Profile · Level 3" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });
});

describe("LevelChip", () => {
  it("links to the profile and names the level and title", () => {
    render(LevelChip, { level: LEVEL_3, title: "Curious Mind" });
    const chip = screen.getByRole("link", { name: "Level 3 · Curious Mind" });
    expect(chip).toHaveAttribute("href", "/profile");
    expect(chip).toHaveTextContent("3");
  });

  it("says how far the next level is", () => {
    render(LevelChip, { level: LEVEL_3, title: "Curious Mind" });
    expect(screen.getByRole("progressbar", { name: "Progress to level 4" })).toHaveAttribute(
      "aria-valuetext",
      "45 of 141 XP to level 4",
    );
  });
});
