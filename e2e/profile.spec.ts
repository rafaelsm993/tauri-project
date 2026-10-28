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
    for (const name of ["Stats", "Progression", "Library", "Taste", "Forecast"]) {
      await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("region", { name: "Progression", exact: true }).locator("svg").first(),
    ).toBeVisible();
    await expect(page.getByText("Coming soon.")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Activity", exact: true })).toHaveCount(0);
    await expect(page.locator(".progression-tree")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Explore media trees" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Achievements", exact: true })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Accent", exact: true })).toHaveCount(0);
  });

  test("the range switch changes the selected range", async ({ page }) => {
    const range = page
      .getByRole("region", { name: "Progression", exact: true })
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

test("hero stacks avatar/title/level and uses the exact nav ring orientation", async ({ page }) => {
  await page.goto("/profile");
  const card = page.getByRole("region", { name: "Level", exact: true });
  const ring = card.locator(".ring");
  await expect(ring).toBeVisible();
  const title = card.locator(".level-title"),
    current = card.locator(".level-current");
  await expect(current).toContainText("Level ");
  const a = (await ring.boundingBox())!,
    b = (await title.boundingBox())!,
    c = (await current.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  expect(c.y).toBeGreaterThanOrEqual(b.y + b.height);
  const transform = await card
    .locator(".level-ring")
    .evaluate((e) => getComputedStyle(e).transform);
  expect(transform).toBe(
    await page.locator(".app-nav .level-ring").evaluate((e) => getComputedStyle(e).transform),
  );
  expect(transform).toBe("matrix(0, -1, 1, 0, 0, 0)");
  expect(await card.locator(".fill").getAttribute("stroke-dashoffset")).toBe(
    await page.locator(".app-nav .level-ring .fill").getAttribute("stroke-dashoffset"),
  );
});

test("all family legend labels fit inside Profile at the smallest width", async ({ page }) => {
  const { mockLibrary, item } = await import("./fixtures/library");
  const entries = ["movie", "tv", "anime", "manga", "book", "game"].map((type, i) =>
    item(600 + i, type, `Legend ${type}`, {}, null),
  );
  const events = entries.map((e, i) => ({
    id: `legend-${i}`,
    kind: "library_add",
    media_key: e.key,
    at_utc: "2026-09-25T12:00:00Z",
    local_date: "2026-09-25",
    payload: { status: "completed" },
  }));
  await mockLibrary(page, entries, { events, seenLevel: 10 });
  await page.goto("/profile");
  const legend = page
    .getByRole("region", { name: "Progression", exact: true })
    .locator(".lc-legend-swatch-group");
  await expect(legend.locator("button")).toHaveCount(5);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBe(0);
  const labels = await legend
    .locator(".lc-legend-swatch-label")
    .evaluateAll((els) => els.map((e) => ({ width: e.clientWidth, content: e.scrollWidth })));
  for (const label of labels) expect(label.content).toBeLessThanOrEqual(label.width);
  const box = (await legend.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
});
