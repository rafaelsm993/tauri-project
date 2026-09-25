import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SegmentedControl from "./SegmentedControl.svelte";

const OPTIONS = [
  { value: "all", label: "All", count: 3 },
  { value: "planning", label: "Planning", count: 2 },
  { value: "dropped", label: "Dropped", count: 0 },
];

describe("SegmentedControl", () => {
  it("is a labelled group with the active option pressed", () => {
    render(SegmentedControl, {
      label: "Status",
      options: OPTIONS,
      value: "all",
      onchange: vi.fn(),
    });
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all 3/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /planning 2/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the clicked value", async () => {
    const onchange = vi.fn();
    render(SegmentedControl, { label: "Status", options: OPTIONS, value: "all", onchange });
    await userEvent.click(screen.getByRole("button", { name: /planning/i }));
    expect(onchange).toHaveBeenCalledWith("planning");
  });

  it("keeps empty options clickable so the user can see the empty state", () => {
    render(SegmentedControl, {
      label: "Status",
      options: OPTIONS,
      value: "all",
      onchange: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /dropped 0/i })).toBeEnabled();
  });
});
