import { describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { render, screen } from "@testing-library/svelte";
import OfflineBanner from "./OfflineBanner.svelte";
import { OnlineStore } from "$lib/stores/online.svelte";

describe("OfflineBanner", () => {
  it("keeps an empty live region while online", () => {
    render(OfflineBanner, { store: new OnlineStore(new EventTarget(), true) });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces that the library still works while offline", () => {
    render(OfflineBanner, { store: new OnlineStore(new EventTarget(), false) });
    expect(screen.getByRole("status")).toHaveTextContent("Offline — your library still works");
  });

  it("appears and clears with the online state", () => {
    const target = new EventTarget();
    render(OfflineBanner, { store: new OnlineStore(target, true) });
    target.dispatchEvent(new Event("offline"));
    flushSync();
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    target.dispatchEvent(new Event("online"));
    flushSync();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
