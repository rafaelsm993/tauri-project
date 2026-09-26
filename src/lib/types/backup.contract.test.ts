import { describe, expect, it } from "vitest";
import fixture from "./backup.contract.fixture.json";
import type { ExportReport, ImportMode, ImportPreview, ImportReport } from "./backup";

const keys = (o: object) => Object.keys(o).sort();
const EXPORT = { path: 0, entries: 0, posters: 0, bytes: 0 } satisfies Record<
  keyof ExportReport,
  0
>;
const PREVIEW = {
  created_at: 0,
  app_version: 0,
  entries: 0,
  events: 0,
  posters: 0,
} satisfies Record<keyof ImportPreview, 0>;
const REPORT = {
  added: 0,
  updated: 0,
  kept: 0,
  removed: 0,
  posters: 0,
  prefs_restored: 0,
} satisfies Record<keyof ImportReport, 0>;
const MODES: ImportMode[] = ["replace", "merge"];

// The fixture is written by the Rust test `backup_contract_fixture_matches_the_rust_types`.
describe("backup contract (Rust ↔ backup.ts)", () => {
  it("has exactly the Rust fields", () => {
    expect(keys(fixture.export_report)).toEqual(keys(EXPORT));
    expect(keys(fixture.import_preview)).toEqual(keys(PREVIEW));
    expect(keys(fixture.import_report)).toEqual(keys(REPORT));
  });

  it("modes are the Rust modes", () => {
    expect(fixture.import_modes).toEqual(MODES);
  });
});
