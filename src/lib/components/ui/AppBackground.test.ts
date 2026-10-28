import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import AppBackground from "./AppBackground.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function isPaused(container: HTMLElement) {
  return container.querySelector(".bg-area")!.classList.contains("paused");
}

// Bubbles are the level-2 unlock (Q15), so a prefs set that wants them must say so.
function readyPrefs(on = true) {
  const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
  prefs.prefs = { ...DEFAULT_PREFS, motion: on, seen_level: 2, motif: "bubbles" };
  prefs.ready = true;
  prefs.loaded = true;
  return prefs;
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((media: string) => ({
      matches: false,
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

describe("AppBackground", () => {
  it("does not begin work in an initially hidden document", () => {
    setHidden(true);
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    expect(isPaused(container)).toBe(true);
  });
  it("does not begin work in an initially unfocused document", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    expect(isPaused(container)).toBe(true);
  });
  it("current eligibility relocks a saved high-level motif without a preference write", async () => {
    const prefs = readyPrefs();
    prefs.prefs = { ...prefs.prefs, seen_level: 25, motif: "aurora" };
    const { container, rerender } = render(AppBackground, { prefs, currentLevel: 1 });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
    await rerender({ prefs, currentLevel: 12 });
    expect(container.querySelector(".circles")).toHaveAttribute("data-motif", "aurora");
    expect(container.querySelectorAll(".circles li").length).toBeGreaterThan(0);
    await rerender({ prefs, currentLevel: 1 });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
    expect(prefs.prefs.motif).toBe("aurora");
  });

  it("current eligibility rejects wrong-kind and failed-load selections", async () => {
    const prefs = readyPrefs();
    prefs.prefs = { ...prefs.prefs, seen_level: 25, motif: "sway" };
    const { container, rerender } = render(AppBackground, { prefs, currentLevel: 25 });
    expect(container.querySelector(".circles")).toHaveAttribute("data-motif", "default");
    prefs.prefs = { ...prefs.prefs, motif: "bubbles" };
    prefs.loaded = false;
    await rerender({ prefs, currentLevel: 25 });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
  });
  afterEach(() => {
    setHidden(false);
    window.dispatchEvent(new Event("focus"));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pauses while the document is hidden and resumes when visible", async () => {
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    expect(isPaused(container)).toBe(false);
    setHidden(true);
    await tick();
    expect(isPaused(container)).toBe(true);
    setHidden(false);
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("pauses while the window is unfocused", async () => {
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    window.dispatchEvent(new Event("blur"));
    await tick();
    expect(isPaused(container)).toBe(true);
    window.dispatchEvent(new Event("focus"));
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("stays paused while the user has turned the animation off", async () => {
    const prefs = readyPrefs(false);
    const { container } = render(AppBackground, { currentLevel: 25, prefs });
    expect(isPaused(container)).toBe(true);
    prefs.prefs = { ...DEFAULT_PREFS, motion: true, seen_level: 2, motif: "bubbles" };
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("stays paused until the saved prefs have loaded", async () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    const { container } = render(AppBackground, { currentLevel: 25, prefs });
    expect(isPaused(container)).toBe(true);
    prefs.prefs = { ...DEFAULT_PREFS, seen_level: 2, motif: "bubbles" };
    prefs.ready = true;
    prefs.loaded = true;
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("draws no bubbles on a fresh install, so the first background is still", () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    prefs.prefs = { ...DEFAULT_PREFS };
    prefs.ready = true;
    prefs.loaded = true;
    const { container } = render(AppBackground, { currentLevel: 25, prefs });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
  });

  it("draws the bubbles once the motif is unlocked and equipped", () => {
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    expect(container.querySelectorAll(".circles li").length).toBeGreaterThan(0);
  });

  it("draws nothing when the motif is equipped but no longer unlocked", () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    prefs.prefs = { ...DEFAULT_PREFS, seen_level: 25, motif: "bubbles" };
    prefs.ready = true;
    prefs.loaded = true;
    const { container } = render(AppBackground, { currentLevel: 1, prefs });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
  });

  it("gives every particle its own geometry from the motif, not a nth-child rule", () => {
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    const first = container.querySelector<HTMLElement>(".circles li")!;
    for (const prop of ["--p-left", "--p-size", "--p-duration", "--p-delay", "--p-opacity"]) {
      expect(first.style.getPropertyValue(prop), `${prop} missing`).not.toBe("");
    }
  });

  it("names the equipped motif on the layer so each gets its own keyframe", () => {
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    expect(container.querySelector(".circles")!.getAttribute("data-motif")).toBe("bubbles");
  });

  it("gives each motif its own keyframe rather than reusing one animation", () => {
    // A keyframe name passed through an inline style escapes Svelte's CSS scoping and silently
    // names a keyframe that does not exist, so the animation must come from the stylesheet.
    const { container } = render(AppBackground, { currentLevel: 25, prefs: readyPrefs() });
    const ul = container.querySelector<HTMLElement>(".circles")!;
    expect(ul.style.getPropertyValue("--p-keyframe")).toBe("");
    expect(ul.querySelector<HTMLElement>("li")!.style.getPropertyValue("animation-name")).toBe("");
  });

  it("draws nothing until the saved prefs have loaded, so no motif flashes on boot", () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    prefs.prefs = { ...DEFAULT_PREFS, motion: true, seen_level: 2, motif: "bubbles" };
    const { container } = render(AppBackground, { currentLevel: 25, prefs });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
  });

  it("swaps the whole scene the moment a different motif is equipped", async () => {
    const prefs = readyPrefs();
    const { container } = render(AppBackground, { currentLevel: 25, prefs });
    const before = container.querySelector<HTMLElement>(".circles li")!.style.cssText;
    prefs.prefs = { ...prefs.prefs, seen_level: 25, motif: "aurora" };
    await tick();
    expect(container.querySelector(".circles")!.getAttribute("data-motif")).toBe("aurora");
    expect(container.querySelector<HTMLElement>(".circles li")!.style.cssText).not.toBe(before);
  });

  it("draws the other motifs too, not only bubbles", () => {
    for (const motif of ["embers", "aurora"]) {
      const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
      prefs.prefs = { ...DEFAULT_PREFS, motion: true, seen_level: 25, motif };
      prefs.ready = true;
      prefs.loaded = true;
      const { container } = render(AppBackground, { currentLevel: 25, prefs });
      expect(container.querySelectorAll(".circles li").length, motif).toBeGreaterThan(0);
    }
  });

  it("draws the number of particles the user chose", () => {
    const prefs = readyPrefs();
    prefs.prefs = { ...prefs.prefs, particle_count: 6 };
    const { container } = render(AppBackground, { currentLevel: 25, prefs });
    expect(container.querySelectorAll(".circles li")).toHaveLength(6);
  });

  it("draws nothing when the user turns the count down to zero", () => {
    const prefs = readyPrefs();
    prefs.prefs = { ...prefs.prefs, particle_count: 0 };
    const { container } = render(AppBackground, { currentLevel: 25, prefs });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
  });
});
