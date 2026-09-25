import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import ProfileMenu from "./ProfileMenu.svelte";

function setup(current = "/") {
  render(ProfileMenu, { current });
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
});
