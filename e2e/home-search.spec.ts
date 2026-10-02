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
