import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BranchSheet from "./BranchSheet.svelte";
import { entry } from "./fixtures.test-utils";

describe("BranchSheet", () => {
  it("pages thirty real links at a time and clamps after deletion", async () => {
    const branch = {
      id: "movie:adventure",
      label: "Adventure",
      members: Array.from({ length: 61 }, (_, i) => entry(i + 1)),
    };
    const { rerender } = render(BranchSheet, { branch, onclose: vi.fn() });
    const dialog = screen.getByRole("dialog", { name: "Adventure branch" });
    expect(dialog).toHaveFocus();
    expect(within(dialog).getAllByRole("link")).toHaveLength(30);
    expect(within(dialog).getByRole("link", { name: /Story 1 Completed$/ })).toHaveAttribute(
      "href",
      "/media/movie/1",
    );
    expect(screen.getByRole("button", { name: "Previous items" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next items" }));
    expect(within(dialog).getAllByRole("link")).toHaveLength(30);
    expect(within(dialog).queryByText("Story 1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next items" }));
    expect(within(dialog).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Next items" })).toBeDisabled();
    await rerender({ branch: { ...branch, members: [entry(1)] }, onclose: vi.fn() });
    expect(within(dialog).getByRole("link", { name: /Story 1 Completed$/ })).toBeInTheDocument();
    expect(screen.getByText("1–1 of 1")).toBeInTheDocument();
    await rerender({ branch: { ...branch, members: [] }, onclose: vi.fn() });
    expect(within(dialog).queryByRole("link")).toBeNull();
    expect(dialog).toHaveTextContent("No saved entries remain in this branch");
  });

  it("supports manual ids with reserved characters and preserves status text", () => {
    const saved = entry(1, "book", "dropped");
    saved.key = "manual:book:a:b/c";
    render(BranchSheet, {
      branch: { id: "book:fiction", label: "Fiction", members: [saved] },
      onclose: vi.fn(),
    });
    expect(screen.getByRole("link", { name: /Story 1 Dropped$/ })).toHaveAttribute(
      "href",
      "/media/book/a%3Ab%2Fc",
    );
  });

  it("closes on Escape and Back through the shared modal", async () => {
    const onclose = vi.fn();
    render(BranchSheet, { branch: { id: "empty", label: "Empty", members: [] }, onclose });
    await userEvent.keyboard("{Escape}");
    expect(onclose).toHaveBeenCalledOnce();
  });
});
