import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";

const menu = (page: Page) => page.getByRole("navigation", { name: "Profile" });

for (const path of ["/", "/library", "/media/movie/1"]) {
  test(`the profile menu is on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Profile menu" })).toBeVisible();
  });
}

test("the menu lists Home, Profile, Library and Settings and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Profile menu" }).click();
  await expect(menu(page).getByRole("link")).toHaveText(["Home", "Profile", "Library", "Settings"]);
  await menu(page).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(menu(page)).toBeHidden();
});

test("Home in the menu brings you back from another screen", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Profile menu" }).click();
  await menu(page).getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("textbox", { name: "Search field" })).toBeVisible();
});

test("on home the avatar sits on the search bar's line and the carousels' right edge", async ({
  page,
}) => {
  await page.goto("/");
  const avatar = (await page.getByRole("button", { name: "Profile menu" }).boundingBox())!;
  const search = (await page.locator(".search-bar").boundingBox())!;
  const carousel = (await page.locator("section.carousel").first().boundingBox())!;
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  expect(Math.abs(mid(avatar) - mid(search)), "vertical centre vs search bar").toBeLessThan(2);
  expect(
    Math.abs(avatar.x + avatar.width - (carousel.x + carousel.width)),
    "right edge vs carousels",
  ).toBeLessThan(2);
  const overlaps = avatar.x < search.x + search.width && search.x < avatar.x + avatar.width;
  expect(overlaps, "avatar overlaps the search bar").toBe(false);
});

for (const path of ["/library", "/settings", "/profile"]) {
  test(`the avatar sits level with the page title and on its right edge on ${path}`, async ({
    page,
  }) => {
    await page.goto(path);
    const avatar = (await page.getByRole("button", { name: "Profile menu" }).boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
    expect(Math.abs(mid(avatar) - mid(title)), "vertical centre vs title").toBeLessThan(2);
    expect(
      Math.abs(avatar.x + avatar.width - (title.x + title.width)),
      "right edge vs page frame",
    ).toBeLessThan(2);
  });
}

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

test("opening the menu moves focus into it, Escape returns it to the button", async ({ page }) => {
  await page.goto("/library");
  const trigger = page.getByRole("button", { name: "Profile menu" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu(page).getByRole("link", { name: "Library" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu(page).getByRole("link", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("on a page outside the menu, focus lands on the first link", async ({ page }) => {
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: "Profile menu" }).click();
  await expect(menu(page).getByRole("link", { name: "Home" })).toBeFocused();
});

test("choosing a link leaves focus on the new page, not on the menu button", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Profile menu" }).click();
  await menu(page).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("button", { name: "Profile menu" })).not.toBeFocused();
});
