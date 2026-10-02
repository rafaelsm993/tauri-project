import { describe, expect, it, vi } from "vitest";
import { MotionStore } from "./motion.svelte";
import { PrefsStore } from "./prefs.svelte";
import { DEFAULT_PREFS } from "$lib/types/prefs";

function prefsWith(motion: boolean, ready = true) {
  const prefs = new PrefsStore({ load: vi.fn(), update: vi.fn() });
  prefs.prefs = { ...DEFAULT_PREFS, motion };
  prefs.ready = ready;
  return prefs;
}

const system = (reduce: boolean) => ({ current: reduce });

describe("MotionStore", () => {
  it("stays still until the saved settings have loaded", () => {
    expect(new MotionStore(prefsWith(true, false), system(false)).on).toBe(false);
  });

  it("stays still when the user turned animations off", () => {
    expect(new MotionStore(prefsWith(false), system(false)).on).toBe(false);
  });

  it("stays still when the system asks for reduced motion, whatever the setting", () => {
    const motion = new MotionStore(prefsWith(true), system(true));
    expect(motion.on).toBe(false);
    expect(motion.reduced).toBe(true);
  });

  it("moves when the setting is on and the system does not object", () => {
    const motion = new MotionStore(prefsWith(true), system(false));
    expect(motion.on).toBe(true);
    expect(motion.reduced).toBe(false);
  });

  it("follows the setting as it changes", () => {
    const prefs = prefsWith(true);
    const motion = new MotionStore(prefs, system(false));
    prefs.prefs = { ...prefs.prefs, motion: false };
    expect(motion.on).toBe(false);
  });

  it("asks the system's reduce-motion query when none is given", () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMedia);
    expect(new MotionStore(prefsWith(true)).reduced).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    vi.unstubAllGlobals();
  });

  it("assumes no reduce-motion request where the query does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(new MotionStore(prefsWith(true)).on).toBe(true);
    vi.unstubAllGlobals();
  });
});
