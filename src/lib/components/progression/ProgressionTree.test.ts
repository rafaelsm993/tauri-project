import { fireEvent, render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { entry } from "./fixtures.test-utils";
import ProgressionTree from "./ProgressionTree.svelte";
import { page } from "$app/state";
import { pushState } from "$app/navigation";
import { tick } from "svelte";

async function allMedia() {
  await userEvent.click(screen.getByRole("button", { name: "All media" }));
  page.state = {};
  fireEvent(window, new PopStateEvent("popstate"));
  await screen.findByRole("region", { name: "Main progression tree" });
  await tick();
}

describe("Journey tree", () => {
  it.each([
    ["movie", "Movies", "Silver Screen"],
    ["tv", "TV", "Signal Keeper"],
    ["anime", "Anime", "Starlit Frame"],
    ["manga", "Manga", "Panel Keeper"],
    ["book", "Books", "Bound Archivist"],
    ["game", "Games", "Quest Sigil"],
  ] as const)(
    "updates the open %s tree through level-up boundaries and relocking",
    async (type, label, art) => {
      const entries = Array.from({ length: 50 }, (_, i) => entry(i + 1, type));
      const { rerender } = render(ProgressionTree, {
        entries,
        allEntries: entries,
        currentLevel: 1,
        loaded: true,
      });
      await userEvent.click(screen.getByRole("button", { name: label }));
      const map = screen.getByRole("group", { name: "Journey milestones" });
      const nodes = within(map)
        .getAllByRole("button")
        .filter((node) => node.dataset.kind === "art");
      await userEvent.click(nodes[4]);
      const popup = screen.getByRole("dialog", { name: `${art} tier 5` });
      for (const level of [1, 2, 3, 4, 5, 7, 8, 11, 12, 200, 11, 7, 4, 2, 1]) {
        await rerender({ entries, allEntries: entries, currentLevel: level, loaded: true });
        expect(screen.getByRole("group", { name: "Journey milestones" })).toBe(map);
        expect(
          within(map)
            .getAllByRole("button")
            .filter((node) => node.dataset.kind === "art"),
        ).toEqual(nodes);
        expect(screen.getByText(`Current level ${level}`)).toBeInTheDocument();
        for (const [i, minimum] of [1, 3, 5, 8, 12].entries()) {
          const unlocked = level >= minimum;
          expect(nodes[i]).toHaveAccessibleDescription(
            new RegExp(`50 / ${[1, 5, 10, 25, 50][i]} completed`),
          );
          expect(nodes[i]).toHaveTextContent(unlocked ? "Available" : "Locked");
          expect(nodes[i]).toHaveClass(unlocked ? "available" : "locked");
          expect(!!nodes[i].querySelector("[data-lock]")).toBe(!unlocked);
          expect(nodes[i]).toBeEnabled();
        }
        expect(screen.getByRole("dialog", { name: `${art} tier 5` })).toBe(popup);
        expect(popup).toHaveTextContent("50 / 50 completed");
        expect(popup).toHaveTextContent(level >= 12 ? "Available" : "Requirements not met");
      }
      await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
      expect(nodes[4]).toHaveFocus();
      await rerender({ entries: [], allEntries: [], currentLevel: 200, loaded: true });
      for (const node of within(map)
        .getAllByRole("button")
        .filter((node) => node.dataset.kind === "art"))
        expect(node).toHaveTextContent("Locked");
    },
  );
  it("waits for the router when its popstate listener was registered first", async () => {
    render(ProgressionTree, { entries: [], allEntries: [], currentLevel: 1, loaded: true });
    await userEvent.click(screen.getByRole("button", { name: "TV" }));
    const router = () => {
      page.state = {};
    };
    addEventListener("popstate", router, { once: true });
    fireEvent(window, new PopStateEvent("popstate"));
    expect(
      await screen.findByRole("region", { name: "Main progression tree" }),
    ).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "TV" })).toHaveFocus());
  });
  it("owns only transient media history and returns focus after Back", async () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    render(ProgressionTree, { entries: [], allEntries: [], currentLevel: 1, loaded: true });
    await userEvent.click(screen.getByRole("button", { name: "TV" }));
    expect(pushState).toHaveBeenLastCalledWith(
      "",
      expect.objectContaining({ runewood: { tree: expect.any(String), media: "tv" } }),
    );
    await allMedia();
    expect(back).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "TV" })).toHaveFocus();
    expect(screen.queryByRole("region", { name: "TV subtree" })).toBeNull();
    back.mockRestore();
  });
  it.each(["Movies", "TV", "Anime", "Manga", "Books", "Games"])(
    "opens %s from its main-map crest instead of keeping the old triple stack",
    async (name) => {
      render(ProgressionTree, { entries: [], allEntries: [], currentLevel: 1, loaded: true });
      const main = screen.getByRole("region", { name: "Main progression tree" });
      expect(screen.queryByRole("region", { name: /subtree/ })).toBeNull();
      const node = within(main).getByRole("button", { name });
      expect(node.querySelector("svg")).not.toBeNull();
      expect(node).toBeEnabled();
      await userEvent.click(node);
      expect(screen.queryByRole("region", { name: "Main progression tree" })).toBeNull();
      expect(screen.getByRole("region", { name: `${name} subtree` })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name })).toHaveFocus();
      expect(
        screen
          .getByRole("group", { name: "Journey milestones" })
          .querySelectorAll('[data-kind="art"]'),
      ).toHaveLength(5);
    },
  );
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
    await userEvent.click(screen.getByRole("button", { name: "Movies" }));
    await userEvent.click(screen.getByText("Genres & saved items", { selector: "summary" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear tree filters" }));
    expect(onclear).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "Movies subtree" })).toBeInTheDocument();
  });
  it("bounds visible genre branches and leaf previews, and opens the complete branch", async () => {
    const entries = Array.from({ length: 61 }, (_, i) => entry(i + 1));
    entries.push(
      ...Array.from({ length: 9 }, (_, i) => entry(i + 100, "movie", "planning", [`Genre ${i}`])),
    );
    render(ProgressionTree, { entries, allEntries: entries, currentLevel: 8, loaded: true });
    await userEvent.click(screen.getByRole("button", { name: "Movies" }));
    await userEvent.click(screen.getByText("Genres & saved items", { selector: "summary" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Movies" }));
    await userEvent.click(screen.getByRole("button", { name: "Preview Silver Screen tier 1" }));
    const dialog = screen.getByRole("dialog", { name: "Silver Screen tier 1" });
    expect(dialog).toHaveTextContent("Available");
    await rerender({ entries: [], allEntries: [], currentLevel: 1, loaded: true });
    expect(dialog).toHaveTextContent("Requirements not met");
    expect(screen.queryByRole("button", { name: /equip/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    await allMedia();
    await userEvent.click(screen.getByRole("button", { name: "Manga" }));
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
    expect(within(main).getByRole("button", { name: "Movies" })).toHaveTextContent("1 completed");
    await userEvent.click(screen.getByRole("button", { name: "Movies" }));
    await userEvent.click(screen.getByText("Genres & saved items", { selector: "summary" }));
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

  it("keeps both level-eight rewards discoverable without a separate ladder", async () => {
    const { rerender } = render(ProgressionTree, {
      entries: [],
      allEntries: [],
      currentLevel: 7,
      loaded: true,
    });
    for (const level of [7, 8, 200, 7]) {
      await rerender({ entries: [], allEntries: [], currentLevel: level, loaded: true });
      for (const [home, label] of [
        ["TV", "Runic shimmer"],
        ["Manga", "Dusk"],
      ]) {
        await userEvent.click(screen.getByRole("button", { name: home }));
        const opener = screen.getByRole("button", { name: `Preview ${label}` });
        expect(opener).toHaveTextContent(level >= 8 ? "Available" : "Locked");
        await userEvent.click(opener);
        const dialog = screen.getByRole("dialog", { name: label });
        expect(dialog).toHaveTextContent("Requires level 8");
        expect(dialog).toHaveTextContent(level >= 8 ? "Available" : "Requirements not met");
        await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
        expect(opener).toHaveFocus();
        await allMedia();
      }
      expect(screen.queryByText("Level rewards", { selector: "summary" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: /Earlier levels|Later levels|Current level/ }),
      ).toBeNull();
      expect(screen.getByText(`Current level ${level}`)).toBeInTheDocument();
    }
  });
  it("keeps locked nodes tappable and opens the existing popup with canonical requirements", async () => {
    const entries = Array.from({ length: 5 }, (_, i) => entry(i + 1));
    render(ProgressionTree, { entries: [], allEntries: entries, currentLevel: 1, loaded: true });
    expect(screen.queryByText("Level rewards", { selector: "summary" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Movies" }));
    const first = screen.getByRole("button", { name: "Preview Silver Screen tier 1" });
    const second = screen.getByRole("button", { name: "Preview Silver Screen tier 2" });
    expect(first).toHaveTextContent("Available");
    expect(second).toHaveTextContent("Locked");
    expect(second).toBeEnabled();
    expect(second.querySelector("[data-lock]")).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    await userEvent.click(second);
    const dialog = screen.getByRole("dialog", { name: "Silver Screen tier 2" });
    expect(dialog).toHaveTextContent("5 / 5 completed");
    expect(dialog).toHaveTextContent("Requires level 3");
    expect(dialog).toHaveTextContent("Requirements not met");
    expect(screen.queryByRole("button", { name: /equip/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(second).toHaveFocus();
    expect(screen.getByRole("region", { name: "Movies subtree" })).toBeInTheDocument();
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

it("uses the Journey heading and removes the separate ladder", () => {
  render(ProgressionTree, { entries: [], allEntries: [], currentLevel: 1, loaded: true });
  expect(screen.getByText("THE SHARED ROOT")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "JOURNEY TREE" })).toBeInTheDocument();
  expect(screen.queryByText("Level rewards", { selector: "summary" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Earlier levels|Later levels|Current level/ }),
  ).toBeNull();
  expect(screen.getByText("Current level 1")).toBeInTheDocument();
});

it("previews a global background from its home and relocks the open popup", async () => {
  const { rerender } = render(ProgressionTree, {
    entries: [],
    allEntries: [],
    currentLevel: 2,
    loaded: true,
  });
  await userEvent.click(screen.getByRole("button", { name: "Movies" }));
  const opener = screen.getByRole("button", { name: "Preview Bubbles" });
  expect(opener).toHaveTextContent("Available");
  await userEvent.click(opener);
  const dialog = screen.getByRole("dialog", { name: "Bubbles" });
  expect(within(dialog).getByRole("img", { name: "Bubbles preview" })).toBeInTheDocument();
  expect(dialog).toHaveTextContent("Requires level 2");
  expect(dialog).toHaveTextContent("Available");
  expect(within(dialog).queryByRole("button", { name: /equip/i })).toBeNull();
  await rerender({ entries: [], allEntries: [], currentLevel: 1, loaded: true });
  expect(screen.getByRole("dialog", { name: "Bubbles" })).toBe(dialog);
  expect(dialog).toHaveTextContent("Requirements not met");
  await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
  expect(opener).toHaveFocus();
  await allMedia();
  await userEvent.click(screen.getByRole("button", { name: "TV" }));
  expect(screen.queryByRole("button", { name: "Preview Bubbles" })).toBeNull();
});
