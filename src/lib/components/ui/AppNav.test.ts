import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import AppNav from "./AppNav.svelte";

const LEVEL_3 = { level: 3, xp: 305, into: 45, needed: 141, fraction: 0.32 };

describe("AppNav", () => {
  it("keeps the ring, level label, tab marker and Profile label beside equipped artwork", async () => {
    const { rerender } = render(AppNav, {
      section: "profile",
      progress: { level: LEVEL_3, title: "Curious Mind" },
      art: "movie:5",
    });
    const link = screen.getByRole("link", { name: "Profile · Level 3" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.textContent?.trim()).toBe("Profile");
    expect(link.querySelector(".profile-artwork")).not.toBeNull();
    expect(link.querySelector(".profile-artwork")).toHaveAttribute("width", "24");
    expect(link.querySelector(".level-ring")).not.toBeNull();
    expect(link.querySelectorAll("svg:not(.level-ring):not(.profile-artwork)")).toHaveLength(0);
    await rerender({
      section: "profile",
      progress: { level: LEVEL_3, title: "Curious Mind" },
      art: "default",
    });
    expect(link.querySelector(".profile-artwork")).toBeNull();
    expect(link.querySelectorAll("svg")).toHaveLength(2);
    await rerender({
      section: "profile",
      progress: { level: LEVEL_3, title: "Curious Mind" },
      art: "unknown:1",
    });
    expect(link.querySelector(".profile-artwork")).toBeNull();
    expect(link.querySelectorAll("svg")).toHaveLength(2);
  });
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
