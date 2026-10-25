import { describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
import { render, screen } from "@testing-library/svelte";
import LevelCard from "./LevelCard.svelte";
const level = { level: 3, xp: 275, into: 15, needed: 125, fraction: 0.12 };
const title = { name: "Curious Mind", next: { name: "Regular", level: 5 } };
describe("LevelCard artwork", () => {
  it("coexists with the accessible XP ring, level, selected title and next title", () => {
    render(LevelCard, { level, title, xp: 275, art: "movie:25" });
    expect(screen.getByRole("img", { name: "Silver Screen artwork" })).toHaveAttribute(
      "width",
      "64",
    );
    expect(screen.getByRole("img", { name: "Level 3, 15 of 125 XP" })).toBeInTheDocument();
    expect(screen.getByText("Curious Mind")).toBeInTheDocument();
    expect(screen.getByText("275 XP · 110 XP to level 4")).toBeInTheDocument();
    expect(screen.getByText("Next title: Regular at level 5")).toBeInTheDocument();
  });
  it("retains the old level presentation for Default and unknown artwork", async () => {
    const { rerender } = render(LevelCard, { level, title, xp: 275 });
    expect(screen.queryByRole("img", { name: /artwork/ })).toBeNull();
    await rerender({ level, title, xp: 275, art: "unknown:1" });
    expect(screen.queryByRole("img", { name: /artwork/ })).toBeNull();
    expect(screen.getByRole("img", { name: "Level 3, 15 of 125 XP" })).toBeInTheDocument();
  });
});
