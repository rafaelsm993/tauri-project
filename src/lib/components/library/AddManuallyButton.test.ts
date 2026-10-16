import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import AddManuallyButton from "./AddManuallyButton.svelte";
import { ManualEntryStore } from "$lib/stores/manualEntry.svelte";

afterEach(() => vi.restoreAllMocks());

function button(props: Record<string, unknown> = {}) {
  const entry = new ManualEntryStore(vi.fn());
  const open = vi.spyOn(entry, "open");
  render(AddManuallyButton, { entry, ...props });
  return { open, user: userEvent.setup() };
}

describe("AddManuallyButton", () => {
  it("is a labelled button that opens the sheet with its prefill and after", async () => {
    const { open, user } = button({ type: "book", title: "Dune", after: "stay" });
    await user.click(screen.getByRole("button", { name: "Add manually" }));
    expect(open).toHaveBeenCalledExactlyOnceWith({
      type: "book",
      title: "Dune",
      edit: null,
      after: "stay",
    });
  });

  it("as an icon keeps its name for screen readers and shows only the plus", () => {
    button({ variant: "icon" });
    const b = screen.getByRole("button", { name: "Add manually" });
    expect(b).toHaveTextContent("+");
    expect(b).toHaveClass("icon");
  });

  it("as a link reads as text with an invitation", () => {
    button({ variant: "link", label: "Add it yourself" });
    expect(screen.getByRole("button", { name: "Add it yourself" })).toHaveClass("link");
  });

  it("edits a manual item when given its key", async () => {
    const { open, user } = button({ type: "book", edit: "manual:book:1", label: "Edit" });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ edit: "manual:book:1", type: "book" }),
    );
  });

  it("says the sheet is open while it is", async () => {
    const entry = new ManualEntryStore(vi.fn());
    render(AddManuallyButton, { entry });
    const b = screen.getByRole("button", { name: "Add manually" });
    expect(b).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "true");
  });
});
