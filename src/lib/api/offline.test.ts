import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { OnlineStore } from "$lib/stores/online.svelte";
import http from "../../../src-tauri/src/api/http.rs?raw";
import { NETWORK_EVENT, OFFLINE_PREFIX, isOfflineError, watchNetwork } from "./offline";

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

describe("watchNetwork", () => {
  afterEach(() => clearMocks());

  it("matches the Rust NETWORK_EVENT literal", () => {
    const rust = http.match(/pub const NETWORK_EVENT: &str = "([^"]*)";/);
    expect(rust?.[1]).toBe(NETWORK_EVENT);
  });

  it("follows the backend's network events", async () => {
    mockIPC(() => {}, { shouldMockEvents: true });
    const store = new OnlineStore(new EventTarget(), true);
    const stop = await watchNetwork(store);
    await emit(NETWORK_EVENT, { online: false });
    expect(store.online).toBe(false);
    await emit(NETWORK_EVENT, { online: true });
    expect(store.online).toBe(true);
    stop();
  });

  it("resolves to a no-op when events are unavailable", async () => {
    const stop = await watchNetwork(new OnlineStore(new EventTarget(), true));
    expect(() => stop()).not.toThrow();
  });
});
