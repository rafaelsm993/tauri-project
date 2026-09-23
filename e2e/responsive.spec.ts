import { expect, test } from "./fixtures/tauri-ipc";

const SCREENS = [
  { name: "home", path: "/" },
  { name: "detail", path: "/media/movie/1" },
  { name: "library", path: "/library" },
  { name: "profile", path: "/profile" },
  { name: "planner", path: "/planner" },
  { name: "welcome", path: "/welcome" },
];

for (const screen of SCREENS) {
  test.describe(`${screen.name} screen`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");
    });

    test("has no horizontal page overflow", async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
    });
  });
}

test.describe("touch devices", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("category tabs are at least 44px tall on coarse pointers", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    const heights = await page
      .getByRole("navigation", { name: "Categories" })
      .getByRole("button")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBe(6);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("every category tab is reachable (fits or scrolls horizontally)", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Categories" });
    const ok = await nav.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.scrollWidth <= el.clientWidth || ["auto", "scroll"].includes(s.overflowX);
    });
    expect(ok, "tabs overflow their nav and can't be scrolled to").toBe(true);
  });

  test("home content column is not collapsed in the stacked layout", async ({ page }) => {
    const height = await page.getByRole("main").evaluate((el) => el.getBoundingClientRect().height);
    expect(height, "main column collapsed to 0 px and clips its content").toBeGreaterThan(0);
  });

  test("genre filter sits at the end of the category bar and hides during search", async ({
    page,
    isMobile,
  }) => {
    const nav = page.getByRole("navigation", { name: "Categories" });
    const trigger = page.getByRole("button", { name: /^Genres/ });
    await expect(trigger).toBeVisible();
    expect(await nav.getByRole("button").count()).toBe(6);
    const sameBar = await trigger.evaluate(
      (t) => t.closest(".category-bar") !== null && !t.closest("nav"),
    );
    expect(sameBar, "trigger is not in the category bar").toBe(true);
    if (isMobile) expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const bar = (await trigger.evaluate(
      (t) => t.closest(".category-bar")!.getBoundingClientRect().right,
    ))!;
    expect(bar, "category bar is wider than the viewport").toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );

    await page.getByRole("textbox").fill("teste");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Results for", { exact: false })).toBeVisible();
    await expect(trigger).toHaveCount(0);

    await page.getByRole("button", { name: "← Discover" }).click();
    await expect(page.getByRole("button", { name: /^Genres/ })).toBeVisible();
  });

  test("hovering the genre filter does not move it", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /^Genres/ });
    await expect(trigger).toBeVisible();
    const before = (await trigger.boundingBox())!;
    await trigger.hover();
    await page.waitForTimeout(400);
    const after = (await trigger.boundingBox())!;
    expect(Math.round(after.x)).toBe(Math.round(before.x));
    expect(Math.round(after.y)).toBe(Math.round(before.y));
  });

  test("picking genres shows only those carousels", async ({ page }) => {
    const viewport = page.viewportSize()!;
    const headings = page.getByRole("main").getByRole("heading", { level: 2 });
    await expect(headings).toHaveCount(19);

    await page.getByRole("button", { name: /^Genres/ }).click();
    const group = page.getByRole("group", { name: "Genres" });
    await expect(group).toBeVisible();
    const panel = (await group.evaluate((g) =>
      g.closest("[popover]")!.getBoundingClientRect().toJSON(),
    ))!;
    expect(panel.left, "panel starts off-screen").toBeGreaterThanOrEqual(0);
    expect(panel.right, "panel ends off-screen").toBeLessThanOrEqual(viewport.width);
    expect(panel.bottom, "panel runs below the viewport").toBeLessThanOrEqual(viewport.height);

    await group.getByRole("checkbox", { name: "Western" }).check();
    await group.getByRole("checkbox", { name: "Comedy" }).check();
    await expect(page.getByRole("button", { name: "Genres · 2" })).toBeVisible();
    await expect(headings).toHaveText(["Comedy", "Western"]);

    await page.keyboard.press("Escape");
    await expect(group).toBeHidden();
    await expect(headings).toHaveText(["Comedy", "Western"]);
    await expect(
      page.getByRole("main").getByText("Test movie 1 ", { exact: false }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Genres · 2" }).click();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(headings).toHaveCount(19);
  });

  test("carousels load lazily: first paint does not fetch every genre", async ({ page }) => {
    const calls = () =>
      page.evaluate(() => (window as unknown as { __ipcCalls: string[] }).__ipcCalls);
    const discover = async () => (await calls()).filter((c) => c === "catalog_page").length;
    const first = await discover();
    expect(first, "no carousel loaded").toBeGreaterThan(0);
    expect(first, "every carousel was fetched up front").toBeLessThan(19);

    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await expect.poll(discover).toBeGreaterThan(first);
  });

  test("back-to-top button appears after scrolling and is touch-sized", async ({
    page,
    isMobile,
  }) => {
    const button = page.getByRole("button", { name: "Back to top" });
    await expect(button).toHaveCount(0);

    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await expect(button).toBeVisible();

    const box = await button.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, "button has no layout box").not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    if (isMobile) {
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await button.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(button).toHaveCount(0);
  });

  test("card details are visible without hover", async ({ page, isMobile }) => {
    test.skip(!isMobile, "hover reveal is fine on mouse devices");
    const opacity = await page
      .locator(".card__overlay")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});

test.describe("theming", () => {
  test("overriding a channel token re-skins components at runtime", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const active = page
      .getByRole("navigation", { name: "Categories" })
      .getByRole("button", { pressed: true });
    const background = () => active.evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await background();
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--clr-primary-rgb", "0 128 255"),
    );
    expect(before).toContain("229, 9, 20");
    await expect.poll(background).toContain("0, 128, 255");
  });
});
