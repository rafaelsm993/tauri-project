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

test("the window title names the item", async ({ page }) => {
  await page.goto("/media/movie/1");
  await expect(page).toHaveTitle(/^Test movie 1 .* · Aevum$/);
});

test("Back from a detail page puts the app's own title back", async ({ page }) => {
  await page.goto("/");
  await page.locator(".carousel-slot .card").first().click();
  await expect(page).toHaveTitle(/ · Aevum$/);
  await page.goBack();
  await expect(page).toHaveTitle("Aevum");
});

test("offline, a saved item opens from your library copy", async ({ page }) => {
  await withSavedMovie(page);
  await page.addInitScript(() => Object.assign(window, { __offline: true }));
  await page.goto("/media/movie/1");
  await expect(page.getByRole("heading", { level: 1, name: "Saved movie" })).toBeVisible();
  await expect(page.getByText(/Showing your saved copy/)).toBeVisible();
  await expect(page.getByRole("button", { name: /retry|try again/i })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Status" })).toBeVisible();
  await expect(page).toHaveTitle("Saved movie · Aevum");
});

test("on a phone the status bar sits on the tab bar even when the page is short", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width > 768, "the bar is the phone layout");
  await withSavedMovie(page);
  await page.addInitScript(() => Object.assign(window, { __offline: true }));
  await page.goto("/media/movie/1");
  await expect(page.getByText(/Showing your saved copy/)).toBeVisible();
  const bar = (await page.locator(".detail-status").boundingBox())!;
  const nav = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
  expect(Math.abs(bar.y + bar.height - nav.y)).toBeLessThanOrEqual(1);
});

test("offline, an unsaved item shows the error with a retry", async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __offline: true }));
  await page.goto("/media/movie/1");
  await expect(page.getByRole("button", { name: /retry|try again/i })).toBeVisible();
});

test("the poster sits in the hero next to the title", async ({ page }) => {
  await page.addInitScript(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } })
      .__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    const poster =
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='2' height='3'/>";
    internals.invoke = async (cmd, args) => {
      const out = await invoke(cmd, args);
      return cmd === "catalog_detail" ? { ...(out as object), poster_path: poster } : out;
    };
  });
  await page.goto("/media/movie/1");
  const hero = page.locator(".hero");
  await expect(hero.locator(".hero-poster")).toBeVisible();
  await expect(page.locator(".detail-poster")).toHaveCount(0);
  const poster = (await hero.locator(".hero-poster").boundingBox())!;
  const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  expect(poster.x + poster.width).toBeLessThanOrEqual(title.x);
});

test("on a phone the actions stay above the tab bar and never cover the end of the page", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width > 768, "sticky bar is the phone layout");
  await page.goto("/media/movie/1");
  const bar = page.locator(".detail-status");
  await expect(bar).toBeVisible();
  const nav = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
  const before = (await bar.boundingBox())!;
  expect(before.y + before.height).toBeLessThanOrEqual(nav.y + 1);
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
  );
  await expect
    .poll(async () => {
      const b = (await bar.boundingBox())!;
      return Math.round(b.y + b.height - nav.y);
    })
    .toBeLessThanOrEqual(1);
  const last = (await page.locator(".detail-info").boundingBox())!;
  const after = (await bar.boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(after.y + 1);
});

// Gives movie 1 a synopsis long enough to run past three lines at any width.
async function withLongOverview(page: Page) {
  await page.addInitScript(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } })
      .__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    internals.invoke = async (cmd, args) => {
      const answer = await invoke(cmd, args);
      return cmd === "catalog_detail"
        ? { ...(answer as object), overview: "A very long synopsis. ".repeat(60) }
        : answer;
    };
  });
}

test("a long synopsis shows three lines and a Read more button", async ({ page }) => {
  await withLongOverview(page);
  await page.goto("/media/movie/1");
  const text = page.locator(".overview");
  await expect(text).toBeVisible();
  const lines = () =>
    text.evaluate((node) => {
      const line = parseFloat(getComputedStyle(node).lineHeight);
      return Math.round(node.getBoundingClientRect().height / line);
    });
  expect(await lines()).toBe(3);
  const more = page.getByRole("button", { name: "Read more" });
  await expect(more).toBeVisible();
  await more.click();
  expect(await lines()).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Show less" }).click();
  expect(await lines()).toBe(3);
});

test("a short synopsis has no Read more button", async ({ page }) => {
  await page.addInitScript(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } })
      .__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    internals.invoke = async (cmd, args) => {
      const answer = await invoke(cmd, args);
      return cmd === "catalog_detail" ? { ...(answer as object), overview: "Short." } : answer;
    };
  });
  await page.goto("/media/movie/1");
  await expect(page.getByText("Short.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Read more" })).toHaveCount(0);
});
