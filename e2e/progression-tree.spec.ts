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

for (const path of ["/library"]) {
  test(`${path}: six sephirot open isolated media maps and Back restores each crest`, async ({
    page,
  }, info) => {
    await mockLibrary(page, LIBRARY, { events: eventsAtLevel(8), seenLevel: 50, motion: false });
    await page.goto(path);
    if (path === "/library") await page.getByRole("button", { name: "Tree", exact: true }).click();
    const main = mainTree(page);
    await expect(main).toBeVisible();
    await expect(page.locator(".media-detail")).toHaveCount(0);
    await main.screenshot({ path: info.outputPath("main-tree.png") });
    expect(
      await main.locator(".node-seal").evaluateAll((nodes) =>
        nodes.every((node) => {
          const seal = node.getBoundingClientRect();
          const art = node.querySelector("svg")!.getBoundingClientRect();
          return art.width <= seal.width - 8 && art.height <= seal.height - 8;
        }),
      ),
    ).toBe(true);
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
    for (const name of names) {
      await menu(page).getByRole("button", { name, exact: true }).click();
      const detail = page.getByRole("region", { name: `${name} subtree` });
      await expect(detail).toBeVisible();
      await expect(main).toHaveCount(0);
      await expect(detail.getByRole("heading", { name, exact: true })).toBeFocused();
      const nodes = detail
        .getByRole("group", { name: "Journey milestones" })
        .locator('[data-kind="art"]');
      await expect(nodes).toHaveCount(5);
      const reward = nodes.nth(3);
      await expect(reward).toBeEnabled();
      await expect(reward).toContainText("Locked");
      if (name === "TV") await detail.screenshot({ path: info.outputPath("tv-tree.png") });
      await reward.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeFocused();
      await expect(dialog).toContainText("Requires level 8");
      await page.goBack();
      await expect(dialog).toHaveCount(0);
      await expect(reward).toBeFocused();
      await expect(detail).toBeVisible();
      await page.goBack();
      await expect(main).toBeVisible();
      await expect(menu(page).getByRole("button", { name, exact: true })).toBeFocused();
    }
    await expect(main.locator(".level-spine")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
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
  await expect(main.getByRole("button", { name: "Movies", exact: true })).toContainText(
    "1 completed",
  );
  await menu(page).getByRole("button", { name: "Movies", exact: true }).click();
  await page.getByText("Genres & saved items", { exact: true }).click();
  await expect(page.getByRole("region", { name: "Movies subtree" }).getByRole("link")).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Preview Silver Screen tier 1" })).toContainText(
    "Available",
  );
  await page.getByRole("button", { name: "All media", exact: true }).click();
  await menu(page).getByRole("button", { name: "Books", exact: true }).click();
  await page.getByText("Genres & saved items", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Piranesi Planning" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search your library" })).toHaveValue(
    "piranesi",
  );
  await page.getByRole("button", { name: "All media", exact: true }).click();
  await menu(page).getByRole("button", { name: "Movies", exact: true }).click();
  await page.getByText("Genres & saved items", { exact: true }).click();
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
  await page.getByText("Genres & saved items", { exact: true }).click();
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
  await menu(page).getByRole("button", { name: "Movies", exact: true }).click();
  await page.getByText("Genres & saved items", { exact: true }).click();
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
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await menu(page).getByRole("button", { name: "Movies", exact: true }).click();
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
  await menu(page).getByRole("button", { name: "Movies", exact: true }).click();
  await page.getByText("Genres & saved items", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Dune Completed" })).toBeVisible();
  await expect(page.getByText("Dune", { exact: true })).toBeVisible();
  expect(
    await page
      .locator(".runic-map")
      .evaluate(
        (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
      ),
  ).toBe(0);
});

test("media sephirot scroll targets remain outside sticky chrome", async ({ page }) => {
  await mockLibrary(page, LIBRARY, { events: eventsAtLevel(8), seenLevel: 50, motion: false });
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  const target = menu(page).getByRole("button", { name: "Movies", exact: true });
  await expect(target).toBeAttached();
  await target.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect
    .poll(() =>
      target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit === el || !!(hit && el.contains(hit));
      }),
    )
    .toBe(true);
});
