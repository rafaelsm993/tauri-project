import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// There is no SvelteKit router in unit tests; shallow routing keeps its state here.
vi.mock("$app/state", async () => {
  const { SvelteMap } = await import("svelte/reactivity");
  const state = new SvelteMap<string, App.PageState>([["page", {}]]);
  return {
    page: {
      get state() {
        return state.get("page")!;
      },
      set state(value: App.PageState) {
        state.set("page", value);
      },
    },
  };
});
vi.mock("$app/navigation", async () => {
  const { page } = await import("$app/state");
  return {
    pushState: vi.fn((_url: string, state: App.PageState) => {
      page.state = state;
    }),
  };
});

afterEach(async () => {
  const { page } = await import("$app/state");
  page.state = {};
});

// jsdom has no modal dialogs yet; this mirrors the open state the browser keeps.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

// jsdom has no ResizeObserver, which Svelte's `bind:clientHeight` needs. Nothing lays out here,
// so a recorder that never fires is enough: sizes stay 0 and components must cope with that.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom has no Web Animations; Svelte's animate:flip asks for the running ones.
Element.prototype.getAnimations ??= () => [];
Element.prototype.scrollIntoView ??= vi.fn();
globalThis.scrollBy = vi.fn();
