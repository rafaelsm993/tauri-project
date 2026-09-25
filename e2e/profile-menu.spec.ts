import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";

const menu = (page: Page) => page.getByRole("navigation", { name: "Profile" });

for (const path of ["/", "/library", "/media/movie/1"]) {
  test(`the profile menu is on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Profile menu" })).toBeVisible();
  });
}

test("the menu lists Profile, Library and Settings and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Profile menu" }).click();
  await expect(menu(page).getByRole("link")).toHaveText(["Profile", "Library", "Settings"]);
  await menu(page).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(menu(page)).toBeHidden();
});

test("Escape closes the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Profile menu" }).click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
});

test("the open menu stays inside the viewport", async ({ page }) => {
  const viewport = page.viewportSize()!;
  await page.goto("/");
  await page.getByRole("button", { name: "Profile menu" }).click();
  await expect(menu(page)).toBeVisible();
  const box = await menu(page).evaluate((n) =>
    n.closest("[popover]")!.getBoundingClientRect().toJSON(),
  );
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(viewport.width);
});

test("menu targets are touch-sized on coarse pointers", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mouse viewports may use compact targets");
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Profile menu" });
  expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await trigger.click();
  const heights = await menu(page)
    .getByRole("link")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});
