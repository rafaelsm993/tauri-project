import { describe, expect, it } from "vitest";
import fixture from "./library.contract.fixture.json";
import type { Length, LibraryEntry, LibraryEvent, MediaSnapshot, UserData } from "./library";

const ENTRY_KEYS = {
  key: 0,
  snapshot: 0,
  user: 0,
  created_at: 0,
  updated_at: 0,
} satisfies Record<keyof LibraryEntry, 0>;

const SNAPSHOT_KEYS = {
  media_key: 0,
  provider: 0,
  media_type: 0,
  title: 0,
  poster_path: 0,
  poster_file: 0,
  year: 0,
} satisfies Record<keyof MediaSnapshot, 0>;

const USER_KEYS = { status: 0, progress: 0, rating: 0, review: 0, length: 0 } satisfies Record<
  keyof UserData,
  0
>;

const LENGTH_KEYS = {
  runtime_minutes: 0,
  episodes: 0,
  episode_minutes: 0,
  chapters: 0,
  chapter_minutes: 0,
  pages: 0,
  hours: 0,
} satisfies Record<keyof Length, 0>;

const EVENT_KEYS = {
  id: 0,
  kind: 0,
  media_key: 0,
  at_utc: 0,
  local_date: 0,
  payload: 0,
} satisfies Record<keyof LibraryEvent, 0>;

const keys = (o: object) => Object.keys(o).sort();

// The fixture is written by the Rust test `library_contract_fixture_matches_the_rust_types`.
describe("library contract (Rust library types ↔ library.ts)", () => {
  it("LibraryEntry and its parts have exactly the Rust fields", () => {
    expect(keys(fixture.entry)).toEqual(keys(ENTRY_KEYS));
    expect(keys(fixture.entry.snapshot)).toEqual(keys(SNAPSHOT_KEYS));
    expect(keys(fixture.entry.user)).toEqual(keys(USER_KEYS));
    expect(keys(fixture.entry.user.length)).toEqual(keys(LENGTH_KEYS));
  });

  it("LibraryEvent has exactly the Rust fields", () => {
    expect(keys(fixture.event)).toEqual(keys(EVENT_KEYS));
  });

  it("statuses use the Rust spelling", () => {
    const status: UserData["status"] = fixture.entry.user.status as UserData["status"];
    expect(["planning", "in_progress", "completed", "dropped"]).toContain(status);
  });
});
