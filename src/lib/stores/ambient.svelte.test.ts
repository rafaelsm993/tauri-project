import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientStore } from "./ambient.svelte";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("AmbientStore", () => {
  beforeEach(() => vi.spyOn(document, "hasFocus").mockReturnValue(true));
  afterEach(() => {
    setHidden(false);
    vi.restoreAllMocks();
  });

  it("is away while the document is hidden", () => {
    const ambient = new AmbientStore();
    const stop = ambient.watch();
    setHidden(true);
    expect(ambient.away).toBe(true);
    setHidden(false);
    expect(ambient.away).toBe(false);
    stop();
  });

  it("is away while the window is unfocused", () => {
    const ambient = new AmbientStore();
    const stop = ambient.watch();
    window.dispatchEvent(new Event("blur"));
    expect(ambient.away).toBe(true);
    window.dispatchEvent(new Event("focus"));
    expect(ambient.away).toBe(false);
    stop();
  });

  it("reads the current state when it starts watching", () => {
    setHidden(true);
    const ambient = new AmbientStore();
    const stop = ambient.watch();
    expect(ambient.away).toBe(true);
    stop();
  });

  it("reads an unfocused window when it starts watching", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const ambient = new AmbientStore();
    const stop = ambient.watch();
    expect(ambient.away).toBe(true);
    stop();
  });

  it("stops listening after cleanup", () => {
    const ambient = new AmbientStore();
    ambient.watch()();
    window.dispatchEvent(new Event("blur"));
    expect(ambient.blurred).toBe(false);
  });
});
