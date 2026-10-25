import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnlocksStore, type Slot } from "./unlocks.svelte";
import { UNLOCKS } from "$lib/domain/unlocks";
import { DEFAULT_PREFS, type Prefs } from "$lib/types/prefs";

function fakePrefs(overrides: Partial<Prefs> & { level?: number } = {}) {
  const update = vi.fn(async () => {});
  return {
    update,
    ready: true,
    loaded: true,
    level: overrides.level ?? 1,
    prefs: { ...DEFAULT_PREFS, ...overrides },
  };
}

describe("current eligibility", () => {
  it.each(UNLOCKS)(
    "uses the current boundary for $id without rewriting the selection",
    (reward) => {
      const prefs = fakePrefs({ seen_level: 99, [reward.kind]: reward.id });
      let level = reward.level;
      const store = new UnlocksStore(prefs as never, () => level);
      expect(store[reward.kind]).toBe(reward.id);
      expect(store.canEquip(reward.kind, reward.id)).toBe(true);
      level--;
      expect(store[reward.kind]).toBe("default");
      expect(store.canEquip(reward.kind, reward.id)).toBe(false);
      expect(store.locked.map((u) => u.id)).toContain(reward.id);
      expect(store.unlocked.map((u) => u.id)).not.toContain(reward.id);
      level++;
      expect(store[reward.kind]).toBe(reward.id);
      expect(prefs.prefs[reward.kind]).toBe(reward.id);
      expect(prefs.update).not.toHaveBeenCalled();
    },
  );

  it.each(UNLOCKS)("rejects $id in the wrong equipment slot", async (reward) => {
    for (const slot of ["accent", "pack", "motif", "garden"] as Slot[]) {
      if (slot === reward.kind) continue;
      const prefs = fakePrefs({ seen_level: 99, [slot]: reward.id });
      const store = new UnlocksStore(prefs as never, () => 25);
      expect(store[slot]).toBe("default");
      expect(store.canEquip(slot, reward.id)).toBe(false);
      await store.equip(slot, reward.id);
      expect(prefs.update).not.toHaveBeenCalled();
    }
  });

  it("draws no equipment before successful prefs hydration or before the current level is known", () => {
    const prefs = fakePrefs({ seen_level: 25, accent: "ocean", motif: "aurora" });
    const store = new UnlocksStore(prefs as never, () => 25);
    prefs.loaded = false;
    expect(store.level).toBe(0);
    expect(store.accent).toBe("default");
    expect(store.motif).toBe("default");
    expect(store.canEquip("accent", "ocean")).toBe(false);
    prefs.loaded = true;
    expect(store.accent).toBe("ocean");
    const unknown = new UnlocksStore(prefs as never, () => null);
    expect(unknown.level).toBe(0);
    expect(unknown.tokens).toEqual({});
    expect(unknown.motif).toBe("default");
  });

  it("rejects unknown IDs in every slot and always permits Default", async () => {
    const prefs = fakePrefs({ seen_level: 99 });
    const store = new UnlocksStore(prefs as never, () => 25);
    for (const slot of ["accent", "pack", "motif", "garden"] as Slot[]) {
      prefs.prefs[slot] = "future:unknown";
      expect(store[slot]).toBe("default");
      expect(store.canEquip(slot, "future:unknown")).toBe(false);
      expect(store.canEquip(slot, "default")).toBe(true);
      await store.equip(slot, "default");
      expect(prefs.update).toHaveBeenCalledWith({ [slot]: "default" });
    }
  });
  it("relocks every slot at current level 1 despite a historical level of 25", () => {
    const prefs = fakePrefs({
      seen_level: 25,
      accent: "ocean",
      pack: "midnight",
      motif: "aurora",
      garden: "sway",
    });
    const store = new UnlocksStore(prefs as never, () => 1);
    expect(store.unlocked).toEqual([]);
    expect(store.next?.id).toBe("bubbles");
    for (const slot of ["accent", "pack", "motif", "garden"] as const)
      expect(store[slot]).toBe("default");
    expect(store.tokens).toEqual({});
    expect(prefs.update).not.toHaveBeenCalled();
    expect(prefs.prefs.seen_level).toBe(25);
    expect(prefs.prefs.accent).toBe("ocean");
  });
});

function storeFor(prefs: ReturnType<typeof fakePrefs>) {
  return new UnlocksStore(prefs as never, () => prefs.level);
}

describe("UnlocksStore", () => {
  let prefs: ReturnType<typeof fakePrefs>;

  beforeEach(() => {
    prefs = fakePrefs({ level: 1 });
  });

  it("shows nothing unlocked at level 1", () => {
    const store = storeFor(prefs);
    expect(store.unlocked).toEqual([]);
    expect(store.locked.length).toBeGreaterThan(0);
  });

  it("names the next reward so the profile can promise it", () => {
    const store = storeFor(prefs);
    expect(store.next?.id).toBe("bubbles");
  });

  it("opens bubbles at current level 2", () => {
    const store = storeFor(fakePrefs({ level: 2 }));
    expect(store.unlocked.map((u) => u.id)).toContain("bubbles");
  });

  it("reads the injected current level", () => {
    const store = storeFor(fakePrefs({ level: 12 }));
    expect(store.unlocked.map((u) => u.id)).toContain("aurora");
  });

  it("reports the base theme a palette must suit, treating system as dark", () => {
    expect(storeFor(fakePrefs({ theme: "light" })).baseTheme).toBe("light");
    expect(storeFor(fakePrefs({ theme: "dark" })).baseTheme).toBe("dark");
    expect(storeFor(fakePrefs({ theme: "system" })).baseTheme).toBe("dark");
  });

  it("equips an unlocked accent and saves it", async () => {
    const p = fakePrefs({ level: 5 });
    const store = storeFor(p);
    await store.equip("accent", "ember");
    expect(p.update).toHaveBeenCalledWith({ accent: "ember" });
  });

  it("refuses to equip something still locked", async () => {
    const p = fakePrefs({ level: 1 });
    const store = storeFor(p);
    await store.equip("accent", "ocean");
    expect(p.update).not.toHaveBeenCalled();
  });

  it("clears a slot back to the base palette", async () => {
    const p = fakePrefs({ level: 5, accent: "ember" });
    const store = storeFor(p);
    await store.equip("accent", "default");
    expect(p.update).toHaveBeenCalledWith({ accent: "default" });
  });

  it("will not equip a dark-only pack while the light theme is on", async () => {
    const p = fakePrefs({ level: 25, theme: "light" });
    const store = storeFor(p);
    await store.equip("pack", "midnight");
    expect(p.update).not.toHaveBeenCalled();
  });

  it("equips that same pack under the dark theme", async () => {
    const p = fakePrefs({ level: 25, theme: "dark" });
    const store = storeFor(p);
    await store.equip("pack", "midnight");
    expect(p.update).toHaveBeenCalledWith({ pack: "midnight" });
  });

  it("reports the tokens the equipped combination implies", () => {
    const store = storeFor(fakePrefs({ level: 25, accent: "ember" }));
    expect(store.tokens["--clr-primary-rgb"]).toBeDefined();
  });

  it("reports no tokens when nothing is equipped", () => {
    const store = storeFor(fakePrefs({ level: 25 }));
    expect(store.tokens).toEqual({});
  });

  it("drops an equipped item that is no longer unlocked, rather than applying it", () => {
    const store = storeFor(fakePrefs({ level: 1, accent: "ocean" }));
    expect(store.tokens).toEqual({});
  });

  it("reports the equipped garden reward once it is earned", () => {
    const store = storeFor(fakePrefs({ level: 8, garden: "sway" }));
    expect(store.garden).toBe("sway");
  });

  it("falls back to a still garden when the reward is not earned", () => {
    const store = storeFor(fakePrefs({ level: 7, garden: "sway" }));
    expect(store.garden).toBe("default");
  });

  it("reports no garden reward while none is equipped", () => {
    const store = storeFor(fakePrefs({ level: 8 }));
    expect(store.garden).toBe("default");
  });

  it("equips the garden reward through the garden slot", async () => {
    const p = fakePrefs({ level: 8 });
    await storeFor(p).equip("garden", "sway");
    expect(p.update).toHaveBeenCalledWith({ garden: "sway" });
  });

  it("refuses a garden reward that has not been earned", async () => {
    const p = fakePrefs({ level: 7 });
    await storeFor(p).equip("garden", "sway");
    expect(p.update).not.toHaveBeenCalled();
  });
});
