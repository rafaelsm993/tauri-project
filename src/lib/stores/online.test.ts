import { describe, expect, it } from "vitest";
import { OnlineStore } from "./online.svelte";

const OFFLINE = "offline: error sending request";

describe("OnlineStore", () => {
  it("starts online when the browser says so", () => {
    expect(new OnlineStore(new EventTarget(), true).online).toBe(true);
  });

  it("starts offline when the browser says so", () => {
    expect(new OnlineStore(new EventTarget(), false).online).toBe(false);
  });

  it("an offline-marked failure flips it offline", () => {
    const store = new OnlineStore(new EventTarget(), true);
    store.noteFailure(OFFLINE);
    expect(store.online).toBe(false);
  });

  it("other failures leave it online", () => {
    const store = new OnlineStore(new EventTarget(), true);
    store.noteFailure("HTTP status client error (401 Unauthorized)");
    store.noteFailure(new Error("boom"));
    expect(store.online).toBe(true);
  });

  it("a success after a failure restores it", () => {
    const store = new OnlineStore(new EventTarget(), true);
    store.noteFailure(OFFLINE);
    store.noteSuccess();
    expect(store.online).toBe(true);
  });

  it("a success cannot override the browser being offline", () => {
    const store = new OnlineStore(new EventTarget(), false);
    store.noteSuccess();
    expect(store.online).toBe(false);
  });

  it("follows the window offline and online events", () => {
    const target = new EventTarget();
    const store = new OnlineStore(target, true);
    target.dispatchEvent(new Event("offline"));
    expect(store.online).toBe(false);
    target.dispatchEvent(new Event("online"));
    expect(store.online).toBe(true);
  });

  it("the online event clears an earlier failure so retries can run", () => {
    const target = new EventTarget();
    const store = new OnlineStore(target, true);
    store.noteFailure(OFFLINE);
    target.dispatchEvent(new Event("online"));
    expect(store.online).toBe(true);
  });
});
