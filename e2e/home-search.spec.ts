import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";
import { item } from "./fixtures/library";

// Layers saved entries over the catalog fixture; reloads so the library is read again.
async function withLibrary(page: Page, entries: object[]) {
  await page.addInitScript((list) => {
    type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;
    const ipc = (window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } })
      .__TAURI_INTERNALS__;
    const invoke = ipc.invoke;
    ipc.invoke = (cmd: string, args?: unknown) =>
      cmd === "library_load" ? Promise.resolve(structuredClone(list)) : invoke(cmd, args);
  }, entries);
  await page.reload();
  await page.waitForLoadState("networkidle");
}

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

test("Back from a card returns to the same rail and scroll position", async ({ page }) => {
  const drama = page.locator("section.carousel").filter({
    has: page.getByRole("heading", { name: "Drama" }),
  });
  const card = drama.getByRole("button", { name: /Test movie 1 with/ });
  await expect(async () => {
    await page.evaluate(() => {
      const head = [...document.querySelectorAll("h2")].find((h) => h.textContent === "Drama")!;
      scrollTo({ top: head.getBoundingClientRect().top + scrollY - 80, behavior: "instant" });
    });
    await expect(card).toBeInViewport({ timeout: 1000 });
  }).toPass();
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(300);
  await card.click();
  await expect(page).toHaveURL(/\/media\/movie\/1$/);
  await page.goBack();
  await expect(drama.getByRole("button", { name: /Test movie 1 with/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before - 50);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(before + 50);
});

test("Back from a card keeps the genre you were browsing", async ({ page }) => {
  await page
    .getByRole("button", { name: /see all/i })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /all genres/i })).toBeVisible();
  await page.getByRole("button", { name: /Test movie 3 with/ }).click();
  await expect(page).toHaveURL(/\/media\/movie\/3$/);
  await page.goBack();
  await expect(page.getByRole("button", { name: /all genres/i })).toBeVisible();
});

test("Home shows a Continue row for in-progress items, not while searching", async ({ page }) => {
  await withLibrary(page, [item(9, "movie", "Half watched", {}, null)]);
  const row = page.getByRole("region", { name: "Continue" });
  await expect(row.getByRole("link", { name: /Half watched/ })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search the catalog" });
  await search.fill("dune");
  await search.press("Enter");
  await expect(page.getByText(/Results for/)).toBeVisible();
  await expect(row).toBeHidden();
});

test("a card already in your library says so", async ({ page }) => {
  await withLibrary(page, [item(2, "movie", "Test movie 2", {}, null)]);
  const action = page.locator("section.carousel").first();
  await expect(
    action.getByRole("button", { name: /^Test movie 2 with.*, in your library$/ }),
  ).toBeVisible();
  await expect(action.getByRole("button", { name: /in your library/ })).toHaveCount(1);
});
