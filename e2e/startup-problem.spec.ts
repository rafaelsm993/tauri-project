import { expect, test } from "./fixtures/tauri-ipc";

const PROBLEM = {
  kind: "newer",
  file: "library.json",
  dir: "C:\\Users\\someone-with-a-long-name\\AppData\\Roaming\\com.rafaelsm993.aevum",
  detail: "library.json was written by a newer version of the app (schema v9); update the app",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((p) => Object.assign(window, { __startupProblem: p }), PROBLEM);
  await page.goto("/");
});

test("a refused save file shows why instead of the app", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Your library could not be opened" }),
  ).toBeVisible();
  await expect(page.getByText(PROBLEM.dir)).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile menu" })).toHaveCount(0);
});

test("nothing tries to load the refused data", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Your library could not be opened" }),
  ).toBeVisible();
  const calls = await page.evaluate(
    () => (window as unknown as { __ipcCalls: string[] }).__ipcCalls,
  );
  expect(calls).not.toContain("library_load");
  expect(calls).not.toContain("prefs_load");
});

test("the problem screen fits the viewport", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Your library could not be opened" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
});
