import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, item, manualItem, mockLibrary } from "./fixtures/library";

const MOVIE = item(1, "movie", "Dune", {}, null);
MOVIE.user.status = "completed";
const BOOK = manualItem("book", "Piranesi");
const LIBRARY = [MOVIE, BOOK, item(3, "game", "Hades", {}, null)];
const names = ["Movies", "TV", "Anime", "Manga", "Books", "Games"];
const mainTree = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Main progression tree" });
const menu = (page: import("@playwright/test").Page) =>
  page.getByRole("group", { name: "Explore media trees" });

for (const path of ["/library", "/profile"]) {
  test(`${path}: persistent six-media main tree, menu and isolated detail`, async ({ page }) => {
    await mockLibrary(page, LIBRARY, { events: eventsAtLevel(8), seenLevel: 50, motion: false });
    await page.goto(path);
    if (path === "/library")
      await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Tree" }).click();
    const main = mainTree(page);
    await expect(main).toBeVisible();
    await main.getByRole("button", { name: "Later levels" }).click();
    const original = await main.elementHandle();
    const contents = await main.textContent();
    for (const name of names) {
      await expect(main.getByRole("group", { name })).toBeAttached();
      await menu(page).getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("region", { name: `${name} subtree` })).toBeVisible();
      await expect(page.locator(".media-detail")).toHaveCount(1);
      expect(await main.evaluate((node, saved) => node === saved, original)).toBe(true);
      expect(await main.textContent()).toBe(contents);
      await expect(main.getByText("Levels 11–20")).toBeAttached();
    }
    const ordered = await page.evaluate(() => {
      const root = document.querySelector(".main-tree")!.getBoundingClientRect();
      const menu = document
        .querySelector('[aria-label="Explore media trees"]')!
        .getBoundingClientRect();
      const detail = document.querySelector(".media-detail")!.getBoundingClientRect();
      return root.bottom <= menu.top && menu.bottom <= detail.top;
    });
    expect(ordered).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    const targets = await menu(page)
      .getByRole("button")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          w: n.getBoundingClientRect().width,
          h: n.getBoundingClientRect().height,
        })),
      );
    expect(targets).toHaveLength(6);
    for (const target of targets) {
      expect(target.w).toBeGreaterThanOrEqual(44);
      expect(target.h).toBeGreaterThanOrEqual(44);
    }
  });
  test(`${path}: empty library still exposes all six paths`, async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto(path);
    if (path === "/library") await page.getByRole("button", { name: "Tree", exact: true }).click();
    await expect(mainTree(page)).toBeVisible();
    await expect(menu(page).getByRole("button")).toHaveCount(6);
    await expect(mainTree(page).getByText("0 completed", { exact: true })).toHaveCount(6);
    if (path === "/profile")
      await expect(page.getByRole("region", { name: "Progression", exact: true })).toHaveCount(0);
  });
}

test("Library filters only leaves; menu selection never changes filters or saves", async ({
  page,
}) => {
  await mockLibrary(page, LIBRARY, { events: eventsAtLevel(8), seenLevel: 50 });
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  const main = mainTree(page);
  await page.getByRole("searchbox", { name: "Search your library" }).fill("piranesi");
  await expect(main.getByRole("group", { name: "Movies" })).toContainText("1 completed");
  await expect(page.getByRole("region", { name: "Movies subtree" }).getByRole("link")).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Preview Silver Screen tier 1" })).toContainText(
    "Available",
  );
  await menu(page).getByRole("button", { name: "Books", exact: true }).click();
  await expect(page.getByRole("link", { name: "Piranesi Planning" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search your library" })).toHaveValue(
    "piranesi",
  );
  await menu(page).getByRole("button", { name: "Movies", exact: true }).click();
  await page.getByRole("button", { name: "Clear tree filters" }).click();
  await expect(page.getByRole("link", { name: "Dune Completed" })).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { __ipcCalls: { cmd: string }[] }).__ipcCalls.filter((c) =>
        /^(prefs_update|library_(add|update|remove|plan))$/.test(c.cmd),
      ),
    ),
  ).toEqual([]);
});

test("manual leaves open their actual item and Back keeps the selected view", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await menu(page).getByRole("button", { name: "Books", exact: true }).click();
  await page.getByRole("link", { name: "Piranesi Planning" }).click();
  await expect(page.getByRole("heading", { name: "Piranesi", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Tree", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(mainTree(page)).toBeVisible();
});

test("complete branch pages real items and Back restores opener focus", async ({ page }) => {
  const entries = Array.from({ length: 61 }, (_, i) =>
    item(i + 1000, "movie", `Movie ${i + 1}`, {}, null),
  );
  await mockLibrary(page, entries);
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  const opener = page.getByRole("button", { name: "Open Unclassified branch" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Unclassified branch" });
  await expect(dialog).toBeFocused();
  expect(await dialog.evaluate((n) => n.matches(":modal"))).toBe(true);
  await expect(dialog.getByRole("link")).toHaveCount(30);
  await dialog.getByRole("button", { name: "Next items" }).click();
  await expect(dialog).toContainText("31–60");
  await dialog.getByRole("button", { name: "Next items" }).click();
  await expect(dialog.getByRole("link")).toHaveCount(1);
  await expect(dialog.getByRole("link")).toHaveAttribute("href", "/media/movie/1060");
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("a locked reward previews current requirements and navigates to the real Settings anchor", async ({
  page,
}) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Preview Silver Screen tier 4" }).click();
  const dialog = page.getByRole("dialog", { name: "Silver Screen tier 4" });
  await expect(dialog).toContainText("Requirements not met");
  await expect(dialog.getByRole("button", { name: /equip/i })).toHaveCount(0);
  await dialog.getByRole("link", { name: /Settings/ }).click();
  await expect(page).toHaveURL(/\/settings#profile-artwork$/);
  await expect(page.locator("#profile-artwork")).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("the unequipped tree is static and titles remain readable without hover", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(page.getByRole("link", { name: "Dune Completed" })).toBeVisible();
  await expect(page.getByText("Dune", { exact: true })).toBeVisible();
  expect(
    await mainTree(page).evaluate(
      (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
    ),
  ).toBe(0);
});
