import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import LevelProgress from "./LevelProgress.svelte";

describe("LevelProgress", () => {
  it("is a progress bar that says how far the next level is", () => {
    render(LevelProgress, { level: { level: 3, xp: 305, into: 45, needed: 141, fraction: 0.32 } });
    const bar = screen.getByRole("progressbar", { name: "Progress to level 4" });
    expect(bar).toHaveAttribute("aria-valuenow", "45");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "141");
    expect(bar).toHaveAttribute("aria-valuetext", "45 of 141 XP to level 4");
  });
});
