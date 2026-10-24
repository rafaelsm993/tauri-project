import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LibraryFilterBar from "./LibraryFilterBar.svelte";
import type { FilterOption, StatusFilter, TypeFilter } from "$lib/domain/libraryView";

const statuses: FilterOption<StatusFilter>[] = [
  { value: "all", label: "All", count: 4 },
  { value: "planning", label: "Planning", count: 3 },
  { value: "in_progress", label: "In progress", count: 1 },
  { value: "dropped", label: "Dropped", count: 0 },
];
const types: FilterOption<TypeFilter>[] = [
  { value: "all", label: "All", count: 4 },
  { value: "movie", label: "Movie", count: 1 },
  { value: "anime", label: "Anime", count: 2 },
  { value: "book", label: "Book", count: 0 },
];

function setup(over: Partial<Record<string, unknown>> = {}) {
  const props = {
    statuses,
    types,
    status: "all" as StatusFilter,
    type: "all" as TypeFilter,
    onstatus: vi.fn(),
    ontype: vi.fn(),
    narrow: true,
    ...over,
  };
  const view = render(LibraryFilterBar, props);
  return { props, ...view };
}
const typeRow = () => within(screen.getByRole("group", { name: "Type" }));
const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, " ").trim();

describe("LibraryFilterBar", () => {
  it("shows every type as a chip with its count, and no All", () => {
    setup();
    expect(typeRow().getAllByRole("button").map(text)).toEqual(["Movie 1", "Anime 2", "Book 0"]);
  });

  it("greys out a type with nothing in it", () => {
    setup();
    expect(typeRow().getByRole("button", { name: "Book 0" })).toBeDisabled();
  });

  it("picking a type keeps only that chip, and tapping it again clears it", async () => {
    const { props, rerender } = setup();
    await userEvent.click(typeRow().getByRole("button", { name: "Anime 2" }));
    expect(props.ontype).toHaveBeenCalledWith("anime");
    await rerender({ ...props, type: "anime" });
    const only = typeRow().getAllByRole("button");
    expect(only).toHaveLength(1);
    expect(only[0]).toHaveAccessibleName("Anime 2, remove filter");
    expect(only[0]).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(only[0]);
    expect(props.ontype).toHaveBeenLastCalledWith("all");
  });

  it("shows the status as a removable token", async () => {
    const { props } = setup({ status: "in_progress" });
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: In progress" }));
    expect(props.onstatus).toHaveBeenCalledWith("all");
  });

  it("shows no status token while every status shows", () => {
    setup();
    expect(screen.queryByRole("button", { name: /^remove filter/i })).not.toBeInTheDocument();
  });

  it("says on the Filters button how many filters are on", () => {
    setup({ status: "planning", type: "anime" });
    expect(screen.getByRole("button", { name: "Filters, 2 on" })).toBeInTheDocument();
  });

  it("opens the panel as a sheet on a phone, applying a pick at once", async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await userEvent.click(
      within(within(dialog).getByRole("group", { name: "Status" })).getByRole("button", {
        name: "Planning 3",
      }),
    );
    expect(props.onstatus).toHaveBeenCalledWith("planning");
  });

  it("Reset in the panel clears both filters", async () => {
    const { props } = setup({ status: "planning", type: "anime" });
    await userEvent.click(screen.getByRole("button", { name: "Filters, 2 on" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(props.onstatus).toHaveBeenCalledWith("all");
    expect(props.ontype).toHaveBeenCalledWith("all");
  });

  it("on desktop the button opens a popover instead of a sheet", async () => {
    setup({ narrow: false });
    const button = screen.getByRole("button", { name: "Filters" });
    const panel = document.getElementById(button.getAttribute("popovertarget") ?? "");
    expect(panel).toHaveAttribute("popover", "auto");
    expect(panel).toHaveAttribute("aria-label", "Filters");
    await userEvent.click(button);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("hides the type chips when the library has one type", () => {
    setup({ types: types.slice(0, 2) });
    expect(screen.queryByRole("group", { name: "Type" })).not.toBeInTheDocument();
  });
});
