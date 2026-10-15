import { expect, test } from "./fixtures/tauri-ipc";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
});

test("clearing a search empties the field and brings the carousels back", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search the catalog" });
  await search.fill("dune");
  await search.press("Enter");
  await expect(page.getByText(/Results for/)).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByText(/Results for/)).toHaveCount(0);
  await expect(page.locator("section.carousel").first()).toBeVisible();
});

test("the home search's clear button is touch-sized", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mouse viewports may use compact targets");
  await page.getByRole("searchbox", { name: "Search the catalog" }).fill("dune");
  const box = (await page.getByRole("button", { name: "Clear search" }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
});

test("Escape empties the search and brings the carousels back", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search the catalog" });
  await search.fill("dune");
  await search.press("Enter");
  await expect(page.getByText(/Results for/)).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.getByText(/Results for/)).toHaveCount(0);
  await expect(page.locator("section.carousel").first()).toBeVisible();
});

test("the Discover link leaves the search and empties the field", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search the catalog" });
  await search.fill("dune");
  await search.press("Enter");
  await expect(page.getByText(/Results for/)).toBeVisible();
  await page.getByRole("button", { name: /Discover/ }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByText(/Results for/)).toHaveCount(0);
  await expect(page.locator("section.carousel").first()).toBeVisible();
});

test("the home search keeps the bar's height", async ({ page }) => {
  const form = page.getByRole("search");
  expect((await form.boundingBox())!.height).toBe(52);
});

test("rails far below the screen are not drawn, so their shimmers stay still", async ({ page }) => {
  await page.getByRole("heading", { name: "Action" }).waitFor();
  const drawn = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".carousel-slot > *")].map((rail) =>
        rail.checkVisibility({ contentVisibilityAuto: true }),
      ),
    );
  expect((await drawn()).at(-1), "the last rail is skipped while far away").toBe(false);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => (await drawn()).at(-1)).toBe(true);
});

test("only shimmers in view are animating", async ({ page }) => {
  await page.getByRole("heading", { name: "Action" }).waitFor();
  const strays = () =>
    page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          if (a.playState !== "running" || !(a instanceof CSSAnimation)) return false;
          if (!a.animationName.endsWith("shimmer")) return false;
          const box = (a.effect as KeyframeEffect).target!.getBoundingClientRect();
          const off =
            box.right < 0 || box.left > innerWidth || box.bottom < 0 || box.top > innerHeight;
          return off;
        }).length,
    );
  await expect.poll(strays).toBe(0);
});
