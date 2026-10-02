import { describe, expect, it } from "vitest";
import fixture from "./prefs.contract.fixture.json";
import { DEFAULT_PREFS, type Prefs } from "./prefs";

const PREFS_KEYS = {
  motion: 0,
  seen_level: 0,
  reading_pages_per_hour: 0,
  theme: 0,
} satisfies Record<keyof Prefs, 0>;

const keys = (o: object) => Object.keys(o).sort();

// The fixture is written by the Rust test `prefs_contract_fixture_matches_the_rust_types`.
describe("prefs contract (Rust Prefs ↔ prefs.ts)", () => {
  it("Prefs has exactly the Rust fields", () => {
    expect(keys(fixture.prefs)).toEqual(keys(PREFS_KEYS));
  });

  it("the TS defaults are the Rust defaults", () => {
    expect(DEFAULT_PREFS).toEqual(fixture.prefs);
  });
});
