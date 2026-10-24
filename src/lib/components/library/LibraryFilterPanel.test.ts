import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LibraryFilterPanel from "./LibraryFilterPanel.svelte";
import type { FilterOption, StatusFilter, TypeFilter } from "$lib/domain/libraryView";

const statuses: FilterOption<StatusFilter>[] = [
  { value: "all", label: "All", count: 3 },
  { value: "planning", label: "Planning", count: 3 },
  { value: "dropped", label: "Dropped", count: 0 },
];
const types: FilterOption<TypeFilter>[] = [
  { value: "all", label: "All", count: 3 },
  { value: "tv", label: "TV Show", count: 2 },
  { value: "movie", label: "Movie", count: 1 },
];

function setup(over: Partial<Record<string, unknown>> = {}) {
  const props = {
    statuses,
    types,
    status: "all" as StatusFilter,
    type: "all" as TypeFilter,
    onstatus: vi.fn(),
    ontype: vi.fn(),
    onreset: vi.fn(),
    ...over,
  };
  render(LibraryFilterPanel, props);
  return props;
}

const group = (name: string) => within(screen.getByRole("group", { name }));

describe("LibraryFilterPanel", () => {
  it("picks a status and a type, applying each at once", async () => {
    const p = setup();
    await userEvent.click(group("Status").getByRole("button", { name: "Planning 3" }));
    expect(p.onstatus).toHaveBeenCalledWith("planning");
    await userEvent.click(group("Type").getByRole("button", { name: "TV Show 2" }));
    expect(p.ontype).toHaveBeenCalledWith("tv");
  });

  it("greys out options with nothing in them", () => {
    setup();
    expect(screen.getByRole("button", { name: "Dropped 0" })).toBeDisabled();
  });

  it("offers Reset only while a filter is on", async () => {
    setup();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("resets when a filter is on", async () => {
    const p = setup({ status: "planning" });
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(p.onreset).toHaveBeenCalledTimes(1);
  });

  it("leaves Type out when the library holds one type", () => {
    setup({ types: types.slice(0, 2) });
    expect(screen.queryByRole("group", { name: "Type" })).not.toBeInTheDocument();
  });
});
