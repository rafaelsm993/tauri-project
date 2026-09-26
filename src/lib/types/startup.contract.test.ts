import { describe, expect, it } from "vitest";
import fixture from "./startup.contract.fixture.json";
import type { ProblemKind, StartupProblem } from "./startup";

const keys = (o: object) => Object.keys(o).sort();
const PROBLEM = { kind: 0, file: 0, dir: 0, detail: 0 } satisfies Record<keyof StartupProblem, 0>;
const KINDS: ProblemKind[] = ["newer", "unreadable"];

// The fixture is written by the Rust test `startup_contract_fixture_matches_the_rust_types`.
describe("startup contract (Rust ↔ startup.ts)", () => {
  it("has exactly the Rust fields", () => {
    expect(keys(fixture.problem)).toEqual(keys(PROBLEM));
  });

  it("kinds are the Rust kinds", () => {
    expect(fixture.kinds).toEqual(KINDS);
  });
});
