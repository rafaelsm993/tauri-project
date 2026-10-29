import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LibraryFilterPanel from "./LibraryFilterPanel.svelte";
import type { FilterOption, StatusFilter, TypeFilter } from "$lib/domain/libraryView";
import type { MediaType } from "$lib/types/media";

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
    picked: [] as MediaType[],
    onstatus: vi.fn(),
    ontypes: vi.fn(),
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
    expect(p.ontypes).toHaveBeenCalledWith(["tv"]);
  });

  it("adds a second type, and All clears every type", async () => {
    const p = setup({ picked: ["tv"] });
    const type = group("Type");
    expect(type.getByRole("button", { name: "All 3" })).toHaveAttribute("aria-pressed", "false");
    expect(type.getByRole("button", { name: "TV Show 2" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(type.getByRole("button", { name: "Movie 1" }));
    expect(p.ontypes).toHaveBeenLastCalledWith(["movie", "tv"]);
    await userEvent.click(type.getByRole("button", { name: "All 3" }));
    expect(p.ontypes).toHaveBeenLastCalledWith([]);
  });

  it("offers Reset while only a type is picked", () => {
    setup({ picked: ["tv"] });
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
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
