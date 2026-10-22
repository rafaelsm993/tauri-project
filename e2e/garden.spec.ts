import { expect, test } from "./fixtures/tauri-ipc";
import { item, mockLibrary } from "./fixtures/library";

const LIBRARY = [
  { ...item(1, "movie", "Dune", {}, null), user: { ...item(1, "movie", "Dune", {}, null).user } },
  item(2, "book", "Piranesi", { pages: 300 }, null),
  item(3, "game", "Hades", { hours: 20 }, null),
];

const plants = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "Your garden" }).getByRole("link");

test.describe("garden", () => {
  test.beforeEach(async ({ page }) => {
    await mockLibrary(page, LIBRARY);
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
  });

  test("the grid is the default and the toggle grows the garden", async ({ page }) => {
    await expect(page.getByRole("list", { name: "Your garden" })).toBeHidden();
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    await expect(plants(page)).toHaveCount(3);
  });

  test("a plant opens its item", async ({ page }) => {
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    await page.getByRole("link", { name: /^Piranesi, book/ }).click();
    await expect(page.getByRole("heading", { name: "Piranesi", level: 1 })).toBeVisible();
  });

  test("the filters decide what is planted", async ({ page }) => {
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    await page.getByRole("searchbox", { name: "Search your library" }).fill("dune");
    await expect(plants(page)).toHaveCount(1);
  });

  test("plants fit the viewport and are touch-sized", async ({ page, isMobile }) => {
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "garden is wider than the viewport").toBeLessThanOrEqual(0);
    if (!isMobile) return;
    const boxes = await plants(page).evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    for (const height of boxes) expect(height).toBeGreaterThanOrEqual(44);
  });

  test("the plant titles are not hidden behind a hover", async ({ page, isMobile }) => {
    test.skip(isMobile, "titles are intentionally dropped on phones; the aria name carries them");
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    await expect(page.getByText("Piranesi", { exact: true })).toBeVisible();
  });

  test("every plant stands on a soil line, wrapped rows included", async ({ page }) => {
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    const grounded = await page
      .getByRole("list", { name: "Your garden" })
      .evaluate((list) =>
        [...list.querySelectorAll("li")].every(
          (li) => parseFloat(getComputedStyle(li).borderBottomWidth) > 0,
        ),
      );
    expect(grounded, "a wrapped row would float with no ground under it").toBe(true);
  });

  test("a still garden runs no animations", async ({ page }) => {
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    await expect(plants(page)).toHaveCount(3);
    const running = await page.getByRole("list", { name: "Your garden" }).evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === "running")
        .map((a) => a.constructor.name),
    );
    expect(running, "the garden must cost nothing while idle").toEqual([]);
  });

  test("the profile card plants the library and links to the garden", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    const card = page.getByRole("region", { name: "Garden" });
    await expect(card.getByRole("link", { name: /^Dune, movie/ })).toBeVisible();
    await card.getByRole("link", { name: "Open the garden" }).click();
    await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
  });
});
