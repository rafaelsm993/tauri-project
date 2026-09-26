import { expect, test } from "./fixtures/tauri-ipc";
import type { Page } from "@playwright/test";

type Win = { __offline?: boolean; __ipcCalls: string[] };

const setOffline = (page: Page, offline: boolean) =>
  page.evaluate((o) => {
    (window as unknown as Win).__offline = o;
    if (!o) window.dispatchEvent(new Event("online"));
  }, offline);

const callCount = (page: Page) => page.evaluate(() => (window as unknown as Win).__ipcCalls.length);

test.describe("offline", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toBeVisible();
  });

  test("a network failure shows the banner and the reconnect refills the page", async ({
    page,
  }) => {
    const banner = page.getByRole("status").filter({ hasText: "Offline" });
    await expect(banner).toHaveCount(0);

    await setOffline(page, true);
    await page
      .getByRole("navigation", { name: "Categories" })
      .getByRole("button", { name: "TV Shows" })
      .click();

    await expect(banner).toBeVisible();
    await expect(page.getByText("network unreachable").first()).toBeVisible();
    await expect(page.getByText("offline:", { exact: false })).toHaveCount(0);

    const before = await callCount(page);
    await setOffline(page, false);

    await expect(banner).toHaveCount(0);
    await expect(page.getByText("network unreachable")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toBeVisible();
    expect(await callCount(page)).toBeGreaterThan(before);
    expect(await page.evaluate(() => (window as unknown as Win).__ipcCalls)).toContain(
      "library_retry_posters",
    );
  });

  test("the banner stays inside the viewport", async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    const pill = page.getByRole("status").filter({ hasText: "Offline" });
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
  });
});

test.describe("offline on screens without provider calls", () => {
  const pill = (page: Page) => page.getByRole("status").filter({ hasText: "Offline" });

  test("a cold start on the library while offline shows the pill", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Win).__offline = true;
    });
    await page.goto("/library");
    await expect(pill(page)).toBeVisible();
  });

  test("going offline on the library shows the pill after the next navigation", async ({
    page,
  }) => {
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(pill(page)).toHaveCount(0);
    await setOffline(page, true);
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/settings/);
    await expect(pill(page)).toBeVisible();
    await setOffline(page, false);
    await expect(pill(page)).toHaveCount(0);
  });
});
