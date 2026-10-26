import { describe, expect, it } from "vitest";
import {
  UNLOCKS,
  accentsFor,
  isUnlocked,
  motifsFor,
  nextUnlock,
  unlockedIds,
  type UnlockId,
} from "./unlocks";

describe("the ladder", () => {
  it("starts at level 2, so a fresh install has nothing equipped yet", () => {
    expect(Math.min(...UNLOCKS.map((u) => u.level))).toBe(2);
  });

  it("gives bubbles as the very first unlock", () => {
    const first = [...UNLOCKS].sort((a, b) => a.level - b.level)[0];
    expect(first.id).toBe("bubbles");
    expect(first.level).toBe(2);
  });

  it("is listed in rising level order, so the UI can render it as a ladder", () => {
    const levels = UNLOCKS.map((u) => u.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("has no duplicate ids", () => {
    expect(new Set(UNLOCKS.map((u) => u.id)).size).toBe(UNLOCKS.length);
  });

  it("labels every unlock and says what kind it is", () => {
    for (const u of UNLOCKS) {
      expect(u.label.length).toBeGreaterThan(0);
      expect(["accent", "motif", "pack", "garden"]).toContain(u.kind);
    }
  });
});

describe("isUnlocked", () => {
  it.each(UNLOCKS)("restricts $id to its catalogue slot", (reward) => {
    for (const kind of ["accent", "motif", "pack", "garden"] as const) {
      expect(isUnlocked(reward.id, 25, kind)).toBe(kind === reward.kind);
      expect(isUnlocked(reward.id, reward.level - 1, kind)).toBe(false);
    }
  });

  it("recomputes after a level drops, without remembering prior unlocks", () => {
    expect(unlockedIds(25)).toHaveLength(UNLOCKS.length);
    expect(unlockedIds(1)).toEqual([]);
    expect(nextUnlock(1)?.id).toBe("bubbles");
    expect(isUnlocked("ocean", 1)).toBe(false);
  });
  it("is locked below its level", () => {
    expect(isUnlocked("bubbles", 1)).toBe(false);
  });

  it("opens exactly at its level", () => {
    expect(isUnlocked("bubbles", 2)).toBe(true);
  });

  it("stays open above its level", () => {
    expect(isUnlocked("bubbles", 40)).toBe(true);
  });

  it("treats an unknown id as locked rather than throwing", () => {
    expect(isUnlocked("nonsense" as UnlockId, 99)).toBe(false);
  });
});

describe("unlockedIds", () => {
  it("gives nothing at level 1", () => {
    expect(unlockedIds(1)).toEqual([]);
  });

  it("grows as the level rises and never shrinks", () => {
    let previous = unlockedIds(1).length;
    for (let level = 2; level <= 30; level++) {
      const now = unlockedIds(level).length;
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it("gives every unlock at the top of the ladder", () => {
    const top = Math.max(...UNLOCKS.map((u) => u.level));
    expect(unlockedIds(top)).toHaveLength(UNLOCKS.length);
  });
});

describe("nextUnlock", () => {
  it("points at bubbles from level 1", () => {
    expect(nextUnlock(1)?.id).toBe("bubbles");
  });

  it("always points above the current level", () => {
    for (let level = 1; level <= 30; level++) {
      const next = nextUnlock(level);
      if (next) expect(next.level).toBeGreaterThan(level);
    }
  });

  it("has nothing left to promise at the top", () => {
    expect(nextUnlock(Math.max(...UNLOCKS.map((u) => u.level)))).toBe(null);
  });
});

describe("what the user may equip", () => {
  it("offers no accents and no motifs at level 1", () => {
    expect(accentsFor(1)).toEqual([]);
    expect(motifsFor(1)).toEqual([]);
  });

  it("offers bubbles as a motif once level 2 is reached", () => {
    expect(motifsFor(2).map((m) => m.id)).toContain("bubbles");
  });

  it("only ever offers what the ladder has opened", () => {
    for (const level of [1, 2, 5, 12, 30]) {
      const open = new Set(unlockedIds(level));
      for (const item of [...accentsFor(level), ...motifsFor(level)]) {
        expect(open.has(item.id)).toBe(true);
      }
    }
  });

  it("counts the garden sway as its own kind, not a background motif", () => {
    const sway = UNLOCKS.find((u) => u.id === "sway");
    expect(sway?.kind).toBe("garden");
    expect(sway?.label).toBe("Runic shimmer");
  });

  it("keeps the background motifs to the ones the background can draw", () => {
    expect(UNLOCKS.filter((u) => u.kind === "motif").map((u) => u.id)).toEqual([
      "bubbles",
      "embers",
      "aurora",
    ]);
  });
});
