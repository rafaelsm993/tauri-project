import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";

const animations = (page: Page) => page.getByRole("switch", { name: "Animations" });
const themes = (page: Page) => page.getByRole("group", { name: "Theme" });
const bodyColor = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const LIGHT_BG = "rgb(247, 246, 243)";
const DARK_BG = "rgb(0, 0, 0)";

test("turning animations off saves it and pauses the background", async ({ page }) => {
  await page.goto("/settings");
  await expect(animations(page)).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bg-area")).not.toHaveClass(/paused/);
  await animations(page).click();
  await expect(animations(page)).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".bg-area")).toHaveClass(/paused/);
  const calls = await page.evaluate(
    () => (window as unknown as { __ipcCalls: string[] }).__ipcCalls,
  );
  expect(calls).toContain("prefs_update");
});

test("animations come back on from the keyboard", async ({ page }) => {
  await page.goto("/settings");
  await animations(page).click();
  await expect(animations(page)).toHaveAttribute("aria-checked", "false");
  await animations(page).press("Space");
  await expect(animations(page)).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bg-area")).not.toHaveClass(/paused/);
});

test("settings controls are touch-sized on coarse pointers", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mouse viewports may use compact targets");
  await page.goto("/settings");
  const hit = await animations(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    const grow = (v: string) => (v === "auto" ? 0 : Math.max(0, -parseFloat(v)));
    return {
      height: r.height + grow(before.top) + grow(before.bottom),
      width: r.width + grow(before.left) + grow(before.right),
    };
  });
  expect(hit.height).toBeGreaterThanOrEqual(44);
  expect(hit.width).toBeGreaterThanOrEqual(44);
  const heights = await themes(page)
    .getByRole("button")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});

test("a theme applies at once and repaints the page", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await expect(themes(page).getByRole("button", { name: "System" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await themes(page).getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => bodyColor(page)).toBe(LIGHT_BG);
  await themes(page).getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => bodyColor(page)).toBe(DARK_BG);
});

test("following the system tracks the device's light or dark setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await expect.poll(() => bodyColor(page)).toBe(LIGHT_BG);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => bodyColor(page)).toBe(DARK_BG);
});

test("the last theme is painted before the app starts", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    localStorage.setItem("aevum.theme", "light");
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __boot: string | undefined }).__boot =
        document.documentElement.dataset.theme;
    });
  });
  await page.goto("/settings");
  const boot = await page.evaluate(() => (window as unknown as { __boot?: string }).__boot);
  expect(boot).toBe("light");
});
