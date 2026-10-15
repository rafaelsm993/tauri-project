import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

// There is no SvelteKit router in unit tests; shallow routing keeps its state here.
vi.mock("$app/state", () => ({ page: { state: {} } }));
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
