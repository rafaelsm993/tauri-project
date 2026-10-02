import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const tab = (page: Page, name: string | RegExp) => nav(page).getByRole("link", { name });
const isPhone = (page: Page) => page.viewportSize()!.width <= 768;

for (const path of ["/", "/library", "/planner", "/profile", "/settings", "/media/movie/1"]) {
  test(`the main navigation is on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(nav(page)).toBeVisible();
  });
}

test("every section is one tap away and the tab follows", async ({ page }) => {
  await page.goto("/");
  for (const [name, url, heading] of [
    ["Library", /\/library$/, "Library"],
    ["Planner", /\/planner$/, "Planner"],
    [/^Profile/, /\/profile$/, "Profile"],
    ["Home", /\/$/, null],
  ] as const) {
    await tab(page, name).click();
    await expect(page).toHaveURL(url);
    if (heading) await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(tab(page, name)).toHaveAttribute("aria-current", "page");
  }
});

test("Settings is in the rail on desktop and behind Profile on phone", async ({ page }) => {
  await page.goto("/profile");
  if (isPhone(page)) {
    await expect(tab(page, "Settings")).toBeHidden();
    await page.getByRole("main").getByRole("link", { name: "Settings" }).click();
  } else {
    await expect(page.getByRole("main").getByRole("link", { name: "Settings" })).toBeHidden();
    await tab(page, "Settings").click();
  }
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("a detail page opened from the library keeps Library lit", async ({ page }) => {
  await page.goto("/library");
  await tab(page, "Library").waitFor();
  await page.evaluate(() => {
    history.pushState({}, "", "/media/movie/1");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/media\/movie\/1$/);
  await expect(tab(page, "Library")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "Home")).not.toHaveAttribute("aria-current");
});

test("a detail page opened cold belongs to Home", async ({ page }) => {
  await page.goto("/media/movie/1");
  await expect(tab(page, "Home")).toHaveAttribute("aria-current", "page");
});

test("the level chip on desktop, the level ring on the phone Profile tab", async ({ page }) => {
  await page.goto("/library");
  const chip = page.getByRole("link", { name: "Level 1 · Newcomer" });
  if (isPhone(page)) {
    await expect(chip).toBeHidden();
    await expect(tab(page, "Profile · Level 1")).toBeVisible();
  } else {
    await expect(chip).toBeVisible();
    await expect(chip.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "120 of 141 XP to level 2",
    );
  }
});

test("on desktop the chip sits on the search bar's line and the carousels' right edge", async ({
  page,
}) => {
  test.skip(isPhone(page), "phones show the level in the tab bar");
  await page.goto("/");
  const chip = (await page.getByRole("link", { name: /^Level \d+ · / }).boundingBox())!;
  const search = (await page.locator(".search-bar").boundingBox())!;
  const carousel = (await page.locator("section.carousel").first().boundingBox())!;
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  expect(Math.abs(mid(chip) - mid(search)), "vertical centre vs search bar").toBeLessThan(2);
  expect(
    Math.abs(chip.x + chip.width - (carousel.x + carousel.width)),
    "right edge vs carousels",
  ).toBeLessThan(2);
  expect(chip.x >= search.x + search.width, "chip overlaps the search bar").toBe(true);
});

for (const path of ["/library", "/settings", "/profile"]) {
  test(`on desktop the chip sits level with the title on ${path}`, async ({ page }) => {
    test.skip(isPhone(page), "phones show the level in the tab bar");
    await page.goto(path);
    const chip = (await page.getByRole("link", { name: /^Level \d+ · / }).boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
    expect(Math.abs(mid(chip) - mid(title)), "vertical centre vs title").toBeLessThan(2);
  });
}

test("the phone bar sits at the bottom, full width; the desktop rail on the left", async ({
  page,
}) => {
  const viewport = page.viewportSize()!;
  await page.goto("/");
  const box = (await nav(page).boundingBox())!;
  if (isPhone(page)) {
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    expect(Math.round(box.width)).toBe(viewport.width);
  } else {
    expect(box.x).toBe(0);
    expect(Math.round(box.height)).toBe(viewport.height);
  }
  const main = (await page.getByRole("main").boundingBox())!;
  if (!isPhone(page)) expect(main.x, "content starts right of the rail").toBeGreaterThanOrEqual(80);
});

test("tabs are touch-sized and labels are not cut off", async ({ page, isMobile }) => {
  await page.goto("/");
  const tabs = nav(page).getByRole("link");
  for (const el of await tabs.all()) {
    if (!(await el.isVisible())) continue;
    const box = (await el.boundingBox())!;
    if (isMobile) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    const label = el.locator(".label");
    const clipped = await label.evaluate((n) => n.scrollWidth > n.clientWidth + 1);
    expect(clipped, `label clipped: ${await label.textContent()}`).toBe(false);
  }
});

test("the bar never covers the back-to-top button or the end of the page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Action" }).waitFor();
  await page.mouse.wheel(0, 4000);
  const top = page.getByRole("button", { name: /back to top/i });
  await expect(top).toBeVisible();
  const navBox = (await nav(page).boundingBox())!;
  const topBox = (await top.boundingBox())!;
  if (isPhone(page)) expect(topBox.y + topBox.height).toBeLessThanOrEqual(navBox.y);
  else expect(topBox.x).toBeGreaterThanOrEqual(navBox.x + navBox.width);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const mainBox = (await page.getByRole("main").boundingBox())!;
  if (isPhone(page)) expect(mainBox.y + mainBox.height).toBeLessThanOrEqual(navBox.y + 1);
});

test("keyboard order follows the tabs and focus is visible", async ({ page }) => {
  await page.goto("/settings");
  const links = nav(page).getByRole("link");
  await links.first().focus();
  await expect(links.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tab(page, "Library")).toBeFocused();
});
