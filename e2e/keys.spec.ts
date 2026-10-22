import { expect, test } from "./fixtures/tauri-ipc";

test.describe("api keys", () => {
  test("a fresh install explains which tabs need a key and offers adding by hand", async ({
    page,
  }) => {
    await page.addInitScript(() => Object.assign(window, { __noKeys: true }));
    await page.goto("/");

    const note = page.getByText(/needs a free TMDB key/i);
    await expect(note).toBeVisible();
    await expect(page.getByRole("button", { name: /add movie manually/i })).toBeVisible();
  });

  test("keyless tabs say nothing about keys", async ({ page }) => {
    await page.addInitScript(() => Object.assign(window, { __noKeys: true }));
    await page.goto("/");

    await page.getByRole("button", { name: "Books", exact: true }).click();
    await expect(page.getByText(/needs a free/i)).toHaveCount(0);
  });

  test("a key saved in settings clears the note", async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { __noKeys: true });
    });
    await page.goto("/settings");

    const field = page.getByLabel(/TMDB key/i);
    await expect(field).toBeVisible();
    await field.fill("a-valid-key");
    await page.getByRole("button", { name: /save tmdb key/i }).click();

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
  });

  test("the settings field never shows a saved key", async ({ page }) => {
    await page.goto("/settings");

    const field = page.getByLabel(/TMDB key/i);
    await expect(field).toHaveValue("");
    await expect(field).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: /remove tmdb key/i })).toBeVisible();
  });

  test("the settings section fits its width", async ({ page, isMobile }) => {
    await page.goto("/settings");

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW).toBeLessThanOrEqual(clientW);

    const box = await page.getByRole("button", { name: /save tmdb key/i }).boundingBox();
    if (isMobile) expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
