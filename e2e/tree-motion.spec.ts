import { expect, test, type Page } from "@playwright/test";
import { eventsAtLevel, mockLibrary } from "./fixtures/library";

const ALLOWED = new Set(["opacity", "transform", "strokeDashoffset"]);
const META = new Set(["offset", "computedOffset", "easing", "composite"]);

async function openTree(page: Page, motion: boolean) {
  await mockLibrary(page, [], {
    events: eventsAtLevel(8),
    seenLevel: 66,
    motion,
    prefs: { garden: "sway" },
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/library");
  await page.bringToFront();
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Tree", exact: true })
    .click();
}

// Running keyframe names on the map, without Svelte's scoping prefix.
const running = (page: Page) =>
  page.locator(".runic-map").evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => a.playState === "running")
      .map((a) => (a as CSSAnimation).animationName.replace(/^(svelte|s)-[A-Za-z0-9]+-/, "")),
  );

test("starlight keeps moving on the tree while the window is in use", async ({ page }) => {
  await openTree(page, true);
  await expect
    .poll(() => running(page))
    .toEqual(expect.arrayContaining(["star-travel", "star-twinkle", "sky-twinkle"]));
  await page.waitForTimeout(1200);
  expect(await running(page)).toEqual(expect.arrayContaining(["star-travel", "star-twinkle"]));
  await page
    .getByRole("group", { name: "Explore media trees" })
    .getByRole("button", { name: "Books", exact: true })
    .click();
  await expect(page.locator(".runic-map.media .map-root")).toBeVisible();
  await expect.poll(() => running(page)).toEqual(expect.arrayContaining(["star-twinkle"]));
});

test("starlight animates only cheap properties", async ({ page }) => {
  await openTree(page, true);
  await expect.poll(async () => (await running(page)).length).toBeGreaterThan(0);
  const props = await page
    .locator(".runic-map")
    .evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k))),
    );
  const extra = [...new Set(props)].filter((p) => !ALLOWED.has(p) && !META.has(p));
  expect(extra, "animated properties that force layout or paint").toEqual([]);
});

test("starlight pauses with the background when the window loses focus", async ({ page }) => {
  await openTree(page, true);
  await expect.poll(async () => (await running(page)).length).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(async () => (await running(page)).length).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(async () => (await running(page)).length).toBeGreaterThan(0);
});

test("with Animations off the tree is still", async ({ page }) => {
  await openTree(page, false);
  await page.waitForTimeout(700);
  expect(await running(page)).toEqual([]);
  await expect(page.locator(".runic-map .channel-spark")).toHaveCount(0);
});

test("idle starlight never triggers layout", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP Performance metrics are Chromium-only");
  await openTree(page, true);
  await expect.poll(async () => (await running(page)).length).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const layouts = async () =>
    (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "LayoutCount")!.value;
  const before = await layouts();
  await page.waitForTimeout(2000);
  expect((await layouts()) - before, "layouts during 2 s of idle starlight").toBeLessThanOrEqual(1);
});

test("reduced motion stops the starlight at once", async ({ page }) => {
  await openTree(page, true);
  await expect.poll(async () => (await running(page)).length).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await running(page)).length).toBe(0);
});

test("system reduction blocks equipped shimmer before either map opens", async ({ page }) => {
  await mockLibrary(page, [], {
    events: eventsAtLevel(8),
    seenLevel: 66,
    motion: true,
    prefs: { garden: "sway" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/library");
  await page
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Tree", exact: true })
    .click();
  await expect(page.locator(".progression-tree")).not.toHaveClass(/shimmer/);
  await expect(page.locator(".runic-map .channels")).toHaveCSS("animation-name", "none");
  await page
    .getByRole("group", { name: "Explore media trees" })
    .getByRole("button", { name: "Books", exact: true })
    .click();
  await expect(page.locator(".runic-map.media .map-root")).toHaveCSS("animation-name", "none");
});
