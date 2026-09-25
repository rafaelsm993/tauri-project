import { describe, expect, it } from "vitest";
import http from "../../../src-tauri/src/api/http.rs?raw";
import { OFFLINE_PREFIX, isOfflineError } from "./offline";

describe("offline marker", () => {
  it("matches the Rust OFFLINE_PREFIX literal", () => {
    const rust = http.match(/pub const OFFLINE_PREFIX: &str = "([^"]*)";/);
    expect(rust?.[1]).toBe(OFFLINE_PREFIX);
  });

  it("recognizes marked strings and errors only", () => {
    expect(isOfflineError(`${OFFLINE_PREFIX}connection refused`)).toBe(true);
    expect(isOfflineError(new Error(`${OFFLINE_PREFIX}timed out`))).toBe(true);
    expect(isOfflineError("HTTP status server error (500)")).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
  });
});
