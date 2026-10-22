import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnlocksStore } from "./unlocks.svelte";
import { DEFAULT_PREFS, type Prefs } from "$lib/types/prefs";

function fakePrefs(overrides: Partial<Prefs> = {}) {
  const update = vi.fn(async () => {});
  return {
    update,
    ready: true,
    prefs: { ...DEFAULT_PREFS, ...overrides },
  };
}

describe("UnlocksStore", () => {
  let prefs: ReturnType<typeof fakePrefs>;

  beforeEach(() => {
    prefs = fakePrefs({ seen_level: 1 });
  });

  it("shows nothing unlocked at level 1", () => {
    const store = new UnlocksStore(prefs as never);
    expect(store.unlocked).toEqual([]);
    expect(store.locked.length).toBeGreaterThan(0);
  });

  it("names the next reward so the profile can promise it", () => {
    const store = new UnlocksStore(prefs as never);
    expect(store.next?.id).toBe("bubbles");
  });

  it("opens bubbles once level 2 has been seen", () => {
    const store = new UnlocksStore(fakePrefs({ seen_level: 2 }) as never);
    expect(store.unlocked.map((u) => u.id)).toContain("bubbles");
  });

  it("reads the highest level ever seen, not the current one", () => {
    // seen_level is only ever raised, so a dropped level keeps the reward (Q14).
    const store = new UnlocksStore(fakePrefs({ seen_level: 12 }) as never);
    expect(store.unlocked.map((u) => u.id)).toContain("aurora");
  });

  it("reports the base theme a palette must suit, treating system as dark", () => {
    expect(new UnlocksStore(fakePrefs({ theme: "light" }) as never).baseTheme).toBe("light");
    expect(new UnlocksStore(fakePrefs({ theme: "dark" }) as never).baseTheme).toBe("dark");
    expect(new UnlocksStore(fakePrefs({ theme: "system" }) as never).baseTheme).toBe("dark");
  });

  it("equips an unlocked accent and saves it", async () => {
    const p = fakePrefs({ seen_level: 5 });
    const store = new UnlocksStore(p as never);
    await store.equip("accent", "ember");
    expect(p.update).toHaveBeenCalledWith({ accent: "ember" });
  });

  it("refuses to equip something still locked", async () => {
    const p = fakePrefs({ seen_level: 1 });
    const store = new UnlocksStore(p as never);
    await store.equip("accent", "ocean");
    expect(p.update).not.toHaveBeenCalled();
  });

  it("clears a slot back to the base palette", async () => {
    const p = fakePrefs({ seen_level: 5, accent: "ember" });
    const store = new UnlocksStore(p as never);
    await store.equip("accent", "default");
    expect(p.update).toHaveBeenCalledWith({ accent: "default" });
  });

  it("will not equip a dark-only pack while the light theme is on", async () => {
    const p = fakePrefs({ seen_level: 25, theme: "light" });
    const store = new UnlocksStore(p as never);
    await store.equip("pack", "midnight");
    expect(p.update).not.toHaveBeenCalled();
  });

  it("equips that same pack under the dark theme", async () => {
    const p = fakePrefs({ seen_level: 25, theme: "dark" });
    const store = new UnlocksStore(p as never);
    await store.equip("pack", "midnight");
    expect(p.update).toHaveBeenCalledWith({ pack: "midnight" });
  });

  it("reports the tokens the equipped combination implies", () => {
    const store = new UnlocksStore(fakePrefs({ seen_level: 25, accent: "ember" }) as never);
    expect(store.tokens["--clr-primary-rgb"]).toBeDefined();
  });

  it("reports no tokens when nothing is equipped", () => {
    const store = new UnlocksStore(fakePrefs({ seen_level: 25 }) as never);
    expect(store.tokens).toEqual({});
  });

  it("drops an equipped item that is no longer unlocked, rather than applying it", () => {
    // A restored backup can lower seen_level below what prefs still name as equipped.
    const store = new UnlocksStore(fakePrefs({ seen_level: 1, accent: "ocean" }) as never);
    expect(store.tokens).toEqual({});
  });
});
