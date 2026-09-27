import { expect, test } from "./fixtures/tauri-ipc";

test.describe("profile dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
  });

  test("shows the level, title and XP from the activity log", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    const level = page.getByRole("region", { name: "Level" });
    await expect(level.getByRole("img", { name: /Level 1, 120 of 141 XP/ })).toBeVisible();
    await expect(level.getByText("Newcomer", { exact: true })).toBeVisible();
    await expect(level.getByText(/21 XP to level 2/)).toBeVisible();
  });

  test("draws every chart card", async ({ page }) => {
    for (const name of ["Stats", "Progression", "Activity", "Library", "Taste", "Forecast"]) {
      await expect(page.getByRole("region", { name })).toBeVisible();
    }
    await expect(
      page.getByRole("region", { name: "Progression" }).locator("svg").first(),
    ).toBeVisible();
    await expect(page.getByText("Coming soon.")).toHaveCount(0);
  });

  test("the range switch changes the selected range", async ({ page }) => {
    const range = page
      .getByRole("region", { name: "Progression" })
      .getByRole("group", { name: "Range" });
    await range.getByRole("button", { name: "All" }).click();
    await expect(range.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(range.getByRole("button", { name: "90 days" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("the range switch is touch-sized on coarse pointers", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    const heights = await page
      .getByRole("group", { name: "Range" })
      .getByRole("button")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights).toHaveLength(3);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("no chart card is wider than the page", async ({ page }) => {
    const widest = await page
      .locator("main section")
      .evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().right)));
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(widest).toBeLessThanOrEqual(width);
  });
});
