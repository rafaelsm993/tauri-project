import { expect, test } from "@playwright/test";
import { ipcCalls, mockLibrary } from "./fixtures/library";

test("Settings Back returns to Profile without saving", async ({ page }) => {
  await mockLibrary(page, []);
  await page.goto("/profile");
  await page.getByRole("link", { name: "Settings", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  const before = (await ipcCalls(page)).filter((c) => c.cmd === "prefs_update").length;
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toHaveLength(before);
});

test("cold Settings Back falls back to Profile without leaving the app", async ({ page }) => {
  await mockLibrary(page, []);
  await page.goto("/settings#profile-artwork");
  const button = page.getByRole("button", { name: "Back", exact: true });
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await button.click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
});
