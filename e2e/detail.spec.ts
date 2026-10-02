import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";
import { item } from "./fixtures/library";

type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;

// Puts one saved movie in the library on top of the shared IPC fixture.
async function withSavedMovie(page: Page) {
  await page.addInitScript(
    (entry) => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } })
        .__TAURI_INTERNALS__;
      const invoke = internals.invoke;
      internals.invoke = async (cmd, args) =>
        cmd === "library_load" ? [structuredClone(entry)] : invoke(cmd, args);
    },
    item(1, "movie", "Saved movie", {}, null),
  );
}

// Navigates inside the app the way a link click does, without reloading the page.
async function follow(page: Page, path: string) {
  await page.evaluate((href) => {
    const link = document.createElement("a");
    link.href = href;
    document.body.append(link);
    link.click();
    link.remove();
  }, path);
}

test("a late answer for a page you already left is ignored", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __detailDelays: { "1": 1200, "2": 0 } });
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await follow(page, "/media/movie/1");
  await expect(page).toHaveURL(/\/media\/movie\/1$/);
  await follow(page, "/media/movie/2");
  const current = page.getByRole("heading", { level: 1, name: "Movie 2" });
  await expect(current).toBeVisible();
  await page.waitForTimeout(1600);
  await expect(current).toBeVisible();
  await expect(page).toHaveURL(/\/media\/movie\/2$/);
});

test("Back returns to the library with its search kept", async ({ page }) => {
  await withSavedMovie(page);
  await page.goto("/library");
  const search = page.getByRole("searchbox", { name: "Search your library" });
  await search.fill("saved");
  await page.getByRole("link", { name: /saved movie/i }).click();
  await expect(page).toHaveURL(/\/media\/movie\/1$/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(search).toHaveValue("saved");
});

test("Back on a detail page opened directly goes Home", async ({ page }) => {
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});
