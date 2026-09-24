import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import AppBackground from "./AppBackground.svelte";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function isPaused(container: HTMLElement) {
  return container.querySelector(".bg-area")!.classList.contains("paused");
}

describe("AppBackground", () => {
  afterEach(() => {
    setHidden(false);
    window.dispatchEvent(new Event("focus"));
  });

  it("pauses while the document is hidden and resumes when visible", async () => {
    const { container } = render(AppBackground);
    expect(isPaused(container)).toBe(false);
    setHidden(true);
    await tick();
    expect(isPaused(container)).toBe(true);
    setHidden(false);
    await tick();
    expect(isPaused(container)).toBe(false);
  });

  it("pauses while the window is unfocused", async () => {
    const { container } = render(AppBackground);
    window.dispatchEvent(new Event("blur"));
    await tick();
    expect(isPaused(container)).toBe(true);
    window.dispatchEvent(new Event("focus"));
    await tick();
    expect(isPaused(container)).toBe(false);
  });
});
