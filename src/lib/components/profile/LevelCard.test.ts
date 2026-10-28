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
    const { container } = render(LevelCard, { level, title, xp: 275, art: "movie:25" });
    expect(container.querySelector(".ring .profile-artwork")).toHaveAttribute("width", "64");
    expect(screen.getByRole("img", { name: "Level 3, 15 of 125 XP" })).toBeInTheDocument();
    expect(screen.getByText("Curious Mind")).toBeInTheDocument();
    expect(screen.getByText("275 XP · 110 XP to level 4")).toBeInTheDocument();
    expect(screen.getByText("Next title: Regular at level 5")).toBeInTheDocument();
  });
  it("uses the shared default avatar for Default and unknown artwork", async () => {
    const { container, rerender } = render(LevelCard, { level, title, xp: 275 });
    expect(container.querySelector(".default-avatar")).not.toBeNull();
    await rerender({ level, title, xp: 275, art: "unknown:1" });
    expect(container.querySelector(".default-avatar")).not.toBeNull();
    expect(screen.getByRole("img", { name: "Level 3, 15 of 125 XP" })).toBeInTheDocument();
  });
});

it("centers the avatar in the nav ring and stacks title then current level", () => {
  const { container } = render(LevelCard, { level, title, xp: 275, art: "movie:1" });
  const ring = screen.getByRole("img", { name: "Level 3, 15 of 125 XP" });
  expect(ring.querySelector(".level-ring")).not.toBeNull();
  expect(ring.querySelector(".profile-artwork")).toHaveAttribute("width", "64");
  expect(container.querySelector(".ring-number")).toBeNull();
  const text = container.querySelector(".level-text")!;
  expect(text.children[0]).toHaveTextContent("Curious Mind");
  expect(text.children[1]).toHaveTextContent("Level 3");
});
