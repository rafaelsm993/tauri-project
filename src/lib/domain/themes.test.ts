import { describe, expect, it } from "vitest";
import { ACCENTS, PACKS, DEFAULT_ACCENT, DEFAULT_PACK, offerable, tokensFor } from "./themes";
import { UNLOCKS } from "./unlocks";

const HEX_OR_TRIPLE = /^\d{1,3} \d{1,3} \d{1,3}$/;

describe("built-in palettes", () => {
  it("defines a token set for every accent and pack on the ladder", () => {
    for (const u of UNLOCKS) {
      if (u.kind === "accent") expect(ACCENTS[u.id]).toBeDefined();
      if (u.kind === "pack") expect(PACKS[u.id]).toBeDefined();
    }
  });

  it("writes every value as an rgb channel triple, so alpha composition keeps working", () => {
    for (const set of [...Object.values(ACCENTS), ...Object.values(PACKS)]) {
      for (const value of Object.values(set.tokens)) {
        expect(value).toMatch(HEX_OR_TRIPLE);
      }
    }
  });

  it("only ever overrides --clr-*-rgb channels, never a composed colour", () => {
    for (const set of [...Object.values(ACCENTS), ...Object.values(PACKS)]) {
      for (const token of Object.keys(set.tokens)) {
        expect(token).toMatch(/^--clr-[a-z0-9-]+-rgb$/);
      }
    }
  });

  it("gives an accent the primary pair, so a changed accent is actually visible", () => {
    for (const set of Object.values(ACCENTS)) {
      expect(set.tokens["--clr-primary-rgb"]).toBeDefined();
      expect(set.tokens["--clr-accent-rgb"]).toBeDefined();
    }
  });
});

describe("a palette pinned to one base", () => {
  it("marks the dark-only packs as dark", () => {
    expect(PACKS.midnight.base).toBe("dark");
    expect(PACKS.sunrise.base).toBe("dark");
  });

  it("leaves accents unpinned, since they only move the primary pair", () => {
    for (const set of Object.values(ACCENTS)) expect(set.base).toBeUndefined();
  });

  it("is not offered on the base it does not suit", () => {
    expect(offerable(PACKS.midnight, "light")).toBe(false);
    expect(offerable(PACKS.midnight, "dark")).toBe(true);
  });

  it("offers an unpinned palette on both bases", () => {
    expect(offerable(ACCENTS.ember, "light")).toBe(true);
    expect(offerable(ACCENTS.ember, "dark")).toBe(true);
  });
});

describe("tokensFor", () => {
  it("returns nothing for the defaults, so the base palette is untouched", () => {
    expect(tokensFor(DEFAULT_ACCENT, DEFAULT_PACK)).toEqual({});
  });

  it("returns an accent's tokens when one is equipped", () => {
    expect(tokensFor("ember", DEFAULT_PACK)["--clr-primary-rgb"]).toBeDefined();
  });

  it("lets a pack set the surfaces and the accent keep the primary", () => {
    const merged = tokensFor("ember", "midnight");
    expect(merged["--clr-bg-rgb"]).toBe(PACKS.midnight.tokens["--clr-bg-rgb"]);
    expect(merged["--clr-primary-rgb"]).toBe(ACCENTS.ember.tokens["--clr-primary-rgb"]);
  });

  it("lets the accent win where a pack names the same token", () => {
    // The merge order is the rule: a pack lays the ground, the accent paints on top. Asserted on
    // a token both actually set, so the order cannot be swapped without this failing.
    const shared = Object.keys(ACCENTS.ember.tokens).filter((t) => t in PACKS.midnight.tokens);
    expect(shared.length).toBeGreaterThan(0);
    const merged = tokensFor("ember", "midnight");
    for (const token of shared) {
      expect(merged[token]).toBe(ACCENTS.ember.tokens[token]);
    }
  });

  it("ignores an id it does not know rather than throwing", () => {
    expect(tokensFor("nonsense", "nonsense")).toEqual({});
  });
});
