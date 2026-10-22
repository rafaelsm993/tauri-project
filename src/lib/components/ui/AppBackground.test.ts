import { afterEach, describe, expect, it, vi } from "vitest";
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
  return prefs;
}

describe("AppBackground", () => {
  afterEach(() => {
    setHidden(false);
    window.dispatchEvent(new Event("focus"));
  });

  it("pauses while the document is hidden and resumes when visible", async () => {
    const { container } = render(AppBackground, { prefs: readyPrefs() });
    expect(isPaused(container)).toBe(false);
    setHidden(true);
    await tick();
    expect(isPaused(container)).toBe(true);
    setHidden(false);
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("pauses while the window is unfocused", async () => {
    const { container } = render(AppBackground, { prefs: readyPrefs() });
    window.dispatchEvent(new Event("blur"));
    await tick();
    expect(isPaused(container)).toBe(true);
    window.dispatchEvent(new Event("focus"));
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("stays paused while the user has turned the animation off", async () => {
    const prefs = readyPrefs(false);
    const { container } = render(AppBackground, { prefs });
    expect(isPaused(container)).toBe(true);
    prefs.prefs = { ...DEFAULT_PREFS, motion: true, seen_level: 2, motif: "bubbles" };
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("stays paused until the saved prefs have loaded", async () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    const { container } = render(AppBackground, { prefs });
    expect(isPaused(container)).toBe(true);
    prefs.prefs = { ...DEFAULT_PREFS, seen_level: 2, motif: "bubbles" };
    prefs.ready = true;
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("draws no bubbles on a fresh install, so the first background is still", () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    prefs.prefs = { ...DEFAULT_PREFS };
    prefs.ready = true;
    const { container } = render(AppBackground, { prefs });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
  });

  it("draws the bubbles once the motif is unlocked and equipped", () => {
    const { container } = render(AppBackground, { prefs: readyPrefs() });
    expect(container.querySelectorAll(".circles li").length).toBeGreaterThan(0);
  });

  it("draws nothing when the motif is equipped but no longer unlocked", () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    prefs.prefs = { ...DEFAULT_PREFS, seen_level: 1, motif: "bubbles" };
    prefs.ready = true;
    const { container } = render(AppBackground, { prefs });
    expect(container.querySelectorAll(".circles li")).toHaveLength(0);
  });
});
