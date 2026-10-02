import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";

// Navigates inside the app the way a link click does, without reloading the page.
async function follow(page: Page, path: string) {
  await page.evaluate((href) => {
    const link = document.createElement("a");
    link.href = href;
    document.body.append(link);
    link.click();
    link.remove();
  }, path);
}

test("a late answer for a page you already left is ignored", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __detailDelays: { "1": 1200, "2": 0 } });
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await follow(page, "/media/movie/1");
  await expect(page).toHaveURL(/\/media\/movie\/1$/);
  await follow(page, "/media/movie/2");
  const current = page.getByRole("heading", { level: 1, name: "Movie 2" });
  await expect(current).toBeVisible();
  await page.waitForTimeout(1600);
  await expect(current).toBeVisible();
  await expect(page).toHaveURL(/\/media\/movie\/2$/);
});
