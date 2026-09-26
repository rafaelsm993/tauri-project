import { expect, test } from "./fixtures/tauri-ipc";

const backup = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Backup" });

test.beforeEach(async ({ page }) => {
  await page.goto("/settings");
});

test("export says what was saved and where", async ({ page }) => {
  await backup(page).getByRole("button", { name: "Export backup" }).click();
  await expect(backup(page).getByRole("status")).toContainText("Saved 2 items and 1 poster to");
});

test("a closed save dialog changes nothing", async ({ page }) => {
  await page.evaluate(() => Object.assign(window, { __dialogClosed: true }));
  await backup(page).getByRole("button", { name: "Export backup" }).click();
  await expect(backup(page).getByRole("button", { name: "Export backup" })).toBeEnabled();
  await expect(backup(page).getByRole("status")).toHaveCount(0);
});

test("import previews the backup, then merges it", async ({ page }) => {
  await backup(page).getByRole("button", { name: "Import backup" }).click();
  const preview = page.getByRole("group", { name: "Backup to import" });
  await expect(preview).toContainText("Sep 20, 2026");
  await expect(preview).toContainText("3 items");
  await preview.getByRole("button", { name: "Merge" }).click();
  await expect(backup(page).getByRole("status")).toHaveText("Merged: 2 new, 1 updated, 0 kept.");
  await expect(preview).toHaveCount(0);
});

test("replace needs a second click and names the safety copy", async ({ page }) => {
  await backup(page).getByRole("button", { name: "Import backup" }).click();
  const preview = page.getByRole("group", { name: "Backup to import" });
  await preview.getByRole("button", { name: "Replace" }).click();
  await expect(preview).toContainText("Anything not in the backup is removed");
  await preview.getByRole("button", { name: "Replace library" }).click();
  await expect(backup(page).getByRole("status")).toContainText(
    "Your previous library was saved to",
  );
  const calls = await page.evaluate(
    () => (window as unknown as { __ipcCalls: string[] }).__ipcCalls,
  );
  expect(calls).toContain("backup_apply_import");
});

test("cancel drops the picked backup", async ({ page }) => {
  await backup(page).getByRole("button", { name: "Import backup" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("group", { name: "Backup to import" })).toHaveCount(0);
  const calls = await page.evaluate(
    () => (window as unknown as { __ipcCalls: string[] }).__ipcCalls,
  );
  expect(calls).toContain("backup_cancel_import");
});

test("the preview and long paths fit the screen", async ({ page }) => {
  await backup(page).getByRole("button", { name: "Export backup" }).click();
  await backup(page).getByRole("button", { name: "Import backup" }).click();
  await page.getByRole("button", { name: "Replace" }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
});

test("backup buttons are touch-sized on coarse pointers", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mouse viewports may use compact targets");
  await backup(page).getByRole("button", { name: "Import backup" }).click();
  await expect(page.getByRole("group", { name: "Backup to import" })).toBeVisible();
  const heights = await backup(page)
    .getByRole("button")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThanOrEqual(5);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});
