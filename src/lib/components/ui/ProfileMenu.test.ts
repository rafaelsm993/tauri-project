import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import ProfileMenu from "./ProfileMenu.svelte";

const LEVEL_3 = { level: 3, xp: 305, into: 45, needed: 141, fraction: 0.32 };

function setup(current = "/", progress?: { level: typeof LEVEL_3; title: string }) {
  render(ProfileMenu, { current, progress });
  const trigger = screen.getByRole("button", { name: "Profile menu" });
  const panel = document.getElementById(trigger.getAttribute("popovertarget")!)!;
  return { trigger, panel };
}

describe("ProfileMenu", () => {
  it("is a labelled button that controls a popover", () => {
    const { trigger, panel } = setup();
    expect(panel).toHaveAttribute("popover", "auto");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("lists Home, Profile, Library and Settings in that order", () => {
    const { panel } = setup();
    const nav = within(panel).getByRole("navigation", { name: "Profile", hidden: true });
    const links = within(nav).getAllByRole("link", { hidden: true });
    expect(links.map((a) => [a.textContent?.trim(), a.getAttribute("href")])).toEqual([
      ["Home", "/"],
      ["Profile", "/profile"],
      ["Library", "/library"],
      ["Settings", "/settings"],
    ]);
  });

  it("marks the page you are on", () => {
    const { panel } = setup("/settings");
    const current = within(panel).getByRole("link", { name: "Settings", hidden: true });
    expect(current).toHaveAttribute("aria-current", "page");
    const other = within(panel).getByRole("link", { name: "Library", hidden: true });
    expect(other).not.toHaveAttribute("aria-current");
  });

  it("marks Home only on the home page", () => {
    const { panel } = setup("/");
    const home = within(panel).getByRole("link", { name: "Home", hidden: true });
    expect(home).toHaveAttribute("aria-current", "page");
  });

  it("shows the level, title and progress above the links, linking to the profile", () => {
    const { panel } = setup("/library", { level: LEVEL_3, title: "Curious Mind" });
    const row = within(panel).getByRole("link", {
      name: "Level 3 · Curious Mind",
      hidden: true,
    });
    expect(row).toHaveAttribute("href", "/profile");
    const bar = within(row).getByRole("progressbar", { hidden: true });
    expect(bar).toHaveAttribute("aria-valuetext", "45 of 141 XP to level 4");
    expect(panel.firstElementChild).toBe(row);
  });

  it("shows no level before the log has loaded", () => {
    const { panel } = setup("/");
    expect(within(panel).queryByText(/Level \d/)).not.toBeInTheDocument();
  });
});
