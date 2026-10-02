import { describe, expect, it, vi } from "vitest";
import { goBack, InAppHistory } from "./history";

describe("InAppHistory", () => {
  it("has nothing behind the first page", () => {
    const h = new InAppHistory();
    h.note({ type: "enter" });
    expect(h.canGoBack).toBe(false);
  });

  it("counts each link or goto as a page behind", () => {
    const h = new InAppHistory();
    h.note({ type: "enter" });
    h.note({ type: "link" });
    h.note({ type: "goto" });
    expect(h.depth).toBe(2);
  });

  it("moves back with popstate and never below zero", () => {
    const h = new InAppHistory();
    h.note({ type: "enter" });
    h.note({ type: "link" });
    h.note({ type: "popstate", delta: -1 });
    expect(h.canGoBack).toBe(false);
    h.note({ type: "popstate", delta: -3 });
    expect(h.depth).toBe(0);
  });
});

describe("goBack", () => {
  it("goes back in history when an in-app page is behind", () => {
    const h = new InAppHistory();
    h.note({ type: "link" });
    const back = vi.fn();
    const fallback = vi.fn();
    goBack(fallback, h, back);
    expect(back).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses the fallback when the app was opened on this page", () => {
    const h = new InAppHistory();
    h.note({ type: "enter" });
    const back = vi.fn();
    const fallback = vi.fn();
    goBack(fallback, h, back);
    expect(fallback).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
  });
});
