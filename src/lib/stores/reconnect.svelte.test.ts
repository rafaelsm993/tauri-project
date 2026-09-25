import { describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { OnlineStore, onReconnect } from "./online.svelte";

function setup(initiallyOnline: boolean) {
  const target = new EventTarget();
  const store = new OnlineStore(target, initiallyOnline);
  const fn = vi.fn();
  const stop = $effect.root(() => onReconnect(fn, store));
  flushSync();
  const go = (type: "online" | "offline") => {
    target.dispatchEvent(new Event(type));
    flushSync();
  };
  return { fn, go, stop };
}

describe("onReconnect", () => {
  it("does not fire on mount", () => {
    const { fn, stop } = setup(true);
    expect(fn).not.toHaveBeenCalled();
    stop();
  });

  it("fires once per offline → online transition", () => {
    const { fn, go, stop } = setup(true);
    go("offline");
    expect(fn).not.toHaveBeenCalled();
    go("online");
    go("online");
    expect(fn).toHaveBeenCalledTimes(1);
    go("offline");
    go("online");
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
  });

  it("fires when an app that started offline comes online", () => {
    const { fn, go, stop } = setup(false);
    go("online");
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });
});
