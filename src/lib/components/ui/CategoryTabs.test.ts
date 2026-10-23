import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { MEDIA_LABELS } from "$lib/types/media";
import CategoryTabs from "./CategoryTabs.svelte";

describe("CategoryTabs", () => {
  it("marks only the active category as pressed", () => {
    render(CategoryTabs, { active: "anime", onchange: () => {} });
    expect(screen.getByRole("button", { name: "Anime" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Games" })).toHaveAttribute("aria-pressed", "false");
  });

  it("emits the category key on click", async () => {
    const onchange = vi.fn();
    render(CategoryTabs, { active: "movie", onchange });
    await userEvent.click(screen.getByRole("button", { name: "Games" }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith("game");
  });

  it("maps every tab to a distinct MediaType key (by value, not label)", async () => {
    const mediaTypes = Object.keys(MEDIA_LABELS);
    const onchange = vi.fn();
    render(CategoryTabs, { active: "movie", onchange });

    const nav = screen.getByRole("navigation", { name: "Categories" });
    const tabs = within(nav).getAllByRole("button");
    for (const tab of tabs) await userEvent.click(tab);

    const keys = onchange.mock.calls.map(([key]) => key);
    expect(keys).toHaveLength(tabs.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(mediaTypes).toContain(key);
  });

  it("draws an icon in every tab", () => {
    // Six text labels need ~473px; a 360px phone offers ~290. Icons are what make all six fit.
    const { container } = render(CategoryTabs, { active: "movie", onchange: () => {} });
    const icons = container.querySelectorAll(".category-tab svg path");
    expect(icons).toHaveLength(6);
    for (const path of icons) expect(path.getAttribute("d")).toMatch(/^M/);
  });

  it("keeps the full name for a screen reader when the visible text is shortened", () => {
    const { container } = render(CategoryTabs, { active: "movie", onchange: () => {} });
    // "TV" is what the eye sees in a 54px slot; "TV Shows" is what the tab is called.
    const tv = screen.getByRole("button", { name: "TV Shows" });
    expect(tv.querySelector(".label")!.textContent).toBe("TV");
    // Everything else keeps its real label, so only the one that had to shrink did.
    for (const name of ["Movies", "Anime", "Manga", "Books", "Games"]) {
      expect(screen.getByRole("button", { name }).querySelector(".label")!.textContent).toBe(name);
    }
    expect(container.querySelectorAll(".category-tab svg[aria-hidden='true']")).toHaveLength(6);
  });

  it("holds nothing but categories, so the rail keeps its full width", () => {
    // The genre filter used to sit in this bar behind a divider and took 31% of it on a phone,
    // which is why only two of the six categories were visible.
    const { container } = render(CategoryTabs, { active: "movie", onchange: () => {} });
    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(within(nav).getAllByRole("button")).toHaveLength(6);
    expect(container.querySelectorAll(".category-bar button")).toHaveLength(6);
    expect(container.querySelector(".category-bar__divider")).toBeNull();
  });
});
