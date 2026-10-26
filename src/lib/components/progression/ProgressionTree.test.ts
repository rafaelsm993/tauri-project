import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { entry } from "./fixtures.test-utils";
import ProgressionTree from "./ProgressionTree.svelte";

describe("Runewood tree", () => {
  it.each([
    { motion: true, shimmer: true, currentLevel: 8, loaded: true, expected: true },
    { motion: false, shimmer: true, currentLevel: 8, loaded: true, expected: false },
    { motion: true, shimmer: false, currentLevel: 8, loaded: true, expected: false },
    { motion: true, shimmer: true, currentLevel: 7, loaded: true, expected: false },
    { motion: true, shimmer: true, currentLevel: 8, loaded: false, expected: false },
  ])("gates the finite rune reveal: %o", ({ expected, ...props }) => {
    const { container } = render(ProgressionTree, { entries: [], allEntries: [], ...props });
    expect(!!container.querySelector(".shimmer")).toBe(expected);
  });

  it("offers the caller's clear-filter action only for a filtered empty subtree", async () => {
    const onclear = vi.fn();
    render(ProgressionTree, {
      entries: [],
      allEntries: [entry(1)],
      currentLevel: 1,
      loaded: true,
      onclear,
    });
    await userEvent.click(screen.getByRole("button", { name: "Clear tree filters" }));
    expect(onclear).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "Main progression tree" })).toBeInTheDocument();
  });
  it("bounds visible genre branches and leaf previews, and opens the complete branch", async () => {
    const entries = Array.from({ length: 61 }, (_, i) => entry(i + 1));
    entries.push(
      ...Array.from({ length: 9 }, (_, i) => entry(i + 100, "movie", "planning", [`Genre ${i}`])),
    );
    render(ProgressionTree, { entries, allEntries: entries, currentLevel: 8, loaded: true });
    const detail = screen.getByRole("region", { name: "Movies subtree" });
    expect(within(detail).getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(within(detail).getAllByRole("link").length).toBeLessThanOrEqual(36);
    const opener = within(detail).getByRole("button", { name: "Open Adventure branch" });
    await userEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Adventure branch" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close branch" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    await userEvent.click(within(detail).getByRole("button", { name: "Next branches" }));
    expect(within(detail).getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(within(detail).getByRole("button", { name: "Next branches" })).toBeDisabled();
  });

  it("opens live artwork and theme previews without equipping", async () => {
    const entries = [entry(1)];
    const { rerender } = render(ProgressionTree, {
      entries,
      allEntries: entries,
      currentLevel: 8,
      loaded: true,
    });
    await userEvent.click(screen.getByRole("button", { name: "Preview Silver Screen tier 1" }));
    const dialog = screen.getByRole("dialog", { name: "Silver Screen tier 1" });
    expect(dialog).toHaveTextContent("Available");
    await rerender({ entries: [], allEntries: [], currentLevel: 1, loaded: true });
    expect(dialog).toHaveTextContent("Requirements not met");
    expect(screen.queryByRole("button", { name: /equip/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    await userEvent.click(screen.getByRole("button", { name: "Preview Dusk" }));
    expect(screen.getByRole("dialog", { name: "Dusk" })).toHaveTextContent("Requirements not met");
  });

  it("withdraws stale progress on failed authority and restores all six options after recovery", async () => {
    const entries = [entry(1)];
    const { rerender } = render(ProgressionTree, {
      entries,
      allEntries: entries,
      currentLevel: 8,
      loaded: true,
    });
    await rerender({
      entries,
      allEntries: entries,
      currentLevel: 8,
      loaded: true,
      error: "Library read failed",
    });
    expect(screen.queryByRole("region", { name: "Main progression tree" })).toBeNull();
    expect(screen.getByRole("status", { name: "Tree availability" })).toHaveTextContent(
      "Library read failed",
    );
    await rerender({ entries, allEntries: entries, currentLevel: null, loaded: true, error: "" });
    expect(screen.queryByRole("region", { name: "Main progression tree" })).toBeNull();
    await rerender({ entries, allEntries: entries, currentLevel: 1, loaded: true, error: "" });
    expect(
      within(screen.getByRole("group", { name: "Explore media trees" })).getAllByRole("button"),
    ).toHaveLength(6);
  });

  it("keeps canonical full-library progress while filters limit genre leaves", async () => {
    const movie = entry(1, "movie", "completed", ["Adventure", "Comedy"]);
    const book = entry(2, "book", "in_progress", ["Fantasy"]);
    const allEntries = [movie, movie, book];
    const { rerender } = render(ProgressionTree, {
      entries: [],
      allEntries,
      currentLevel: 8,
      loaded: true,
    });
    const main = screen.getByRole("region", { name: "Main progression tree" });
    expect(within(main).getByRole("group", { name: "Movies" })).toHaveTextContent("1 completed");
    const detail = screen.getByRole("region", { name: "Movies subtree" });
    expect(detail).toHaveTextContent("No movies match the current filters");
    expect(
      within(detail).getByRole("button", { name: "Preview Silver Screen tier 1" }),
    ).toHaveTextContent("Available");
    expect(within(detail).queryByRole("link")).toBeNull();
    await rerender({
      entries: [movie, book, entry(999)],
      allEntries,
      currentLevel: 8,
      loaded: true,
    });
    expect(within(detail).getAllByRole("link", { name: /Story 1/ })).toHaveLength(2);
    expect(within(detail).queryByText("Story 999")).toBeNull();
    expect(within(detail).getAllByRole("link", { name: /Story 1/ })[0]).toHaveAttribute(
      "href",
      "/media/movie/1",
    );
  });

  it("bounds level rows, exposes both level-eight rewards, and preserves its page on selection", async () => {
    const { rerender } = render(ProgressionTree, {
      entries: [],
      allEntries: [],
      currentLevel: 8,
      loaded: true,
    });
    const main = screen.getByRole("region", { name: "Main progression tree" });
    expect(within(main).getAllByRole("listitem")).toHaveLength(10);
    expect(within(main).getByLabelText("Current level 8")).toBeInTheDocument();
    expect(within(main).getByRole("button", { name: "Preview Runic shimmer" })).toBeInTheDocument();
    expect(within(main).getByRole("button", { name: "Preview Dusk" })).toBeInTheDocument();
    await userEvent.click(within(main).getByRole("button", { name: "Later levels" }));
    expect(within(main).getByText("Levels 11–20")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Games" }));
    expect(screen.getByRole("region", { name: "Main progression tree" })).toBe(main);
    expect(within(main).getByText("Levels 11–20")).toBeInTheDocument();
    await userEvent.click(within(main).getByRole("button", { name: "Current level" }));
    expect(within(main).getByLabelText("Current level 8")).toBeInTheDocument();
    await rerender({ entries: [], allEntries: [], currentLevel: 200, loaded: true });
    await userEvent.click(within(main).getByRole("button", { name: "Current level" }));
    expect(within(main).getAllByRole("listitem")).toHaveLength(10);
    expect(within(main).getByLabelText("Current level 200")).toBeInTheDocument();
    await userEvent.click(within(main).getByRole("button", { name: "Later levels" }));
    expect(within(main).getAllByRole("listitem")).toHaveLength(1);
    expect(within(main).getByRole("button", { name: "Later levels" })).toBeDisabled();
  });
  it("places a persistent six-media main tree above its menu and selected detail", async () => {
    render(ProgressionTree, { entries: [], allEntries: [], currentLevel: 1, loaded: true });
    const main = screen.getByRole("region", { name: "Main progression tree" });
    const menu = screen.getByRole("group", { name: "Explore media trees" });
    const detail = screen.getByRole("region", { name: "Movies subtree" });
    expect(detail.id).not.toBe("");
    for (const button of within(menu).getAllByRole("button"))
      expect(button).toHaveAttribute("aria-controls", detail.id);
    expect(main.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(menu.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of ["Movies", "TV", "Anime", "Manga", "Books", "Games"]) {
      expect(within(main).getByRole("group", { name })).toHaveTextContent("0 completed");
      expect(within(menu).getByRole("button", { name })).toBeEnabled();
    }
    const original = main;
    await userEvent.click(within(menu).getByRole("button", { name: "Books" }));
    expect(screen.getByRole("region", { name: "Main progression tree" })).toBe(original);
    expect(screen.getByRole("region", { name: "Books subtree" })).toHaveTextContent(
      "No saved books",
    );
    expect(screen.queryByRole("region", { name: "Movies subtree" })).toBeNull();
    expect(within(menu).getByRole("button", { name: "Books" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it.each([null, 8])(
    "never presents unverified progress at level %s as an earned or empty library",
    (currentLevel) => {
      render(ProgressionTree, { entries: [], allEntries: [], currentLevel });
      expect(screen.getByRole("status", { name: "Tree availability" })).toHaveTextContent(
        "Loading progression",
      );
      expect(screen.queryByRole("region", { name: "Main progression tree" })).toBeNull();
      expect(screen.queryByText("0 completed")).toBeNull();
    },
  );
});
