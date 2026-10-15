import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pauseOffscreen } from "./pauseOffscreen";

type Entry = { isIntersecting: boolean; target: Element };
let instances: FakeObserver[] = [];

class FakeObserver {
  observed: Element[] = [];
  disconnected = false;
  constructor(public cb: (entries: Entry[]) => void) {
    instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    this.cb(this.observed.map((target) => ({ isIntersecting, target })));
  }
}

describe("pauseOffscreen", () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("marks the element offscreen until it is in view, and again when it leaves", () => {
    const el = document.createElement("div");
    pauseOffscreen(el);
    const io = instances[0];
    expect(io.observed).toEqual([el]);

    io.fire(false);
    expect(el.hasAttribute("data-offscreen")).toBe(true);
    io.fire(true);
    expect(el.hasAttribute("data-offscreen")).toBe(false);
    io.fire(false);
    expect(el.hasAttribute("data-offscreen")).toBe(true);
  });

  it("disconnects on teardown", () => {
    const teardown = pauseOffscreen(document.createElement("div"));
    teardown?.();
    expect(instances[0].disconnected).toBe(true);
  });

  it("leaves the element alone when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const el = document.createElement("div");
    pauseOffscreen(el);
    expect(el.hasAttribute("data-offscreen")).toBe(false);
  });
});
