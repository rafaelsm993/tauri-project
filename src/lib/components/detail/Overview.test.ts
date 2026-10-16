import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import Overview from "./Overview.svelte";

// jsdom has no layout: fake how tall the text is against its three-line box.
function textHeight(full: number, box = 60) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(full);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(box);
}

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => vi.restoreAllMocks());

describe("Overview", () => {
  it("offers Read more when the text runs past three lines", async () => {
    textHeight(200);
    render(Overview, { text: "A long synopsis." });
    const toggle = screen.getByRole("button", { name: "Read more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows no button when the text fits in three lines", () => {
    textHeight(60);
    render(Overview, { text: "Short." });
    expect(screen.getByText("Short.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
