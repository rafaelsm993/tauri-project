import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import AppBackground from "./AppBackground.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function isPaused(container: HTMLElement) {
  return container.querySelector(".bg-area")!.classList.contains("paused");
}

function readyPrefs(on = true) {
  const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
  prefs.prefs = { background_animation: on };
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
    prefs.prefs = { background_animation: true };
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("stays paused until the saved prefs have loaded", async () => {
    const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
    const { container } = render(AppBackground, { prefs });
    expect(isPaused(container)).toBe(true);
    prefs.ready = true;
    await tick();
    expect(isPaused(container)).toBe(false);
  });
});
