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

test("the level lives on the Profile tab, at every width", async ({ page }) => {
  // The header carries no level chip any more; a ring hidden above 768px would leave desktop
  // with no level on screen at all.
  await page.goto("/library");
  await expect(page.getByRole("link", { name: /^Level \d/ })).toHaveCount(0);
  await expect(tab(page, "Profile · Level 1")).toBeVisible();
  await expect(nav(page).locator(".level-ring")).toBeVisible();
});

test("the phone bar sits at the bottom, full width; the desktop rail on the left", async ({
  page,
}) => {
  const viewport = page.viewportSize()!;
  await page.goto("/");
  const box = (await nav(page).boundingBox())!;
  if (isPhone(page)) {
    // Full width is what any fixed box gets; mobile WebKit keeps a scrollbar's room out of it.
    const fixedWidth = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.cssText = "position: fixed; left: 0; right: 0; bottom: 0; height: 1px";
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    });
    expect(viewport.width - fixedWidth, "only a scrollbar's width").toBeLessThanOrEqual(20);
    expect(box.x).toBe(0);
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(Math.round(fixedWidth));
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
  await page.evaluate(() => window.scrollTo({ top: 4000, behavior: "instant" }));
  const top = page.getByRole("button", { name: /back to top/i });
  await expect(top).toBeVisible();
  const navBox = (await nav(page).boundingBox())!;
  const topBox = (await top.boundingBox())!;
  if (isPhone(page)) expect(topBox.y + topBox.height).toBeLessThanOrEqual(navBox.y);
  else expect(topBox.x).toBeGreaterThanOrEqual(navBox.x + navBox.width);
  // Rails keep loading as the end comes into view, and WebKit lands the scroll a frame late.
  const mainBottomAtEnd = () =>
    page.evaluate(() => {
      scrollTo(0, document.documentElement.scrollHeight);
      return document.querySelector("main")!.getBoundingClientRect().bottom;
    });
  if (isPhone(page)) await expect.poll(mainBottomAtEnd).toBeLessThanOrEqual(navBox.y + 1);
});

test("keyboard order follows the tabs and focus is visible", async ({ page }) => {
  await page.goto("/settings");
  const links = nav(page).getByRole("link");
  await links.first().focus();
  await expect(links.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tab(page, "Library")).toBeFocused();
});
