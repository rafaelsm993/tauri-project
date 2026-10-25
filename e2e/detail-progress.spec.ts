import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";
import { ipcCalls, item, mockLibrary } from "./fixtures/library";

const plan = { days: [0, 2, 4], max_session_minutes: 60, since: "2026-09-28" };

async function open(page: Page, progress: number, status: string, fake = {}) {
  const manga = item(7, "manga", "Chainsaw Man", { chapters: 10, chapter_minutes: 20 }, plan);
  manga.user = { ...manga.user, status, progress };
  await mockLibrary(page, [manga], { details: { "tmdb:manga:7": { chapters: 10 } }, ...fake });
  await page.goto("/media/manga/7");
  await expect(page.getByRole("slider", { name: "Progress" })).toBeVisible();
}

const patches = async (page: Page) =>
  (await ipcCalls(page))
    .filter((c) => c.cmd === "library_update")
    .map((c) => (c.args as { patch: object }).patch);

test("+ from zero starts the item, and the last unit completes it", async ({ page }) => {
  await open(page, 0, "planning");
  await expect(page.getByText("Status: Planning")).toBeVisible();
  await page.getByRole("button", { name: "One chapter more" }).click();
  await expect(page.getByText("Status: In progress")).toBeVisible();
  await page.getByRole("slider", { name: "Progress" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByText("Status: Completed")).toBeVisible();
  expect(await patches(page)).toContainEqual({ progress: 1, status: "in_progress" });
  expect(await patches(page)).toContainEqual({ progress: 10, status: "completed" });
});

test("a tap on the bar jumps there", async ({ page }) => {
  await open(page, 0, "planning");
  const box = (await page.locator(".px-meter").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".count-now")).toHaveText("5");
  await expect(page.getByText("Status: In progress")).toBeVisible();
});

test("Drop, then Resume goes back to what the progress says", async ({ page }) => {
  await open(page, 4, "in_progress");
  await page.getByRole("button", { name: "Drop" }).click();
  await expect(page.getByText("Status: Dropped")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log session" })).toBeDisabled();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Status: In progress")).toBeVisible();
});

test("on a phone the four actions fit one row with nothing off-screen", async ({ page }) => {
  test.skip(page.viewportSize()!.width > 768, "the fixed bar is the phone layout");
  await open(page, 4, "in_progress");
  const bar = page.getByRole("toolbar", { name: "Item actions" });
  const tops = new Set<number>();
  for (const name of ["Edit plan", "Log session", "Drop", "Remove"]) {
    const button = bar.getByRole("button", { name });
    await expect(button).toBeInViewport({ ratio: 1 });
    tops.add(Math.round((await button.boundingBox())!.y));
  }
  expect(tops.size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test("the bar's fill is the equipped accent, as wide as the progress", async ({ page }) => {
  await open(page, 5, "in_progress", { seenLevel: 99, prefs: { accent: "ember" } });
  const [fill, accent] = await page
    .locator(".px-fill")
    .evaluate((el) => [
      getComputedStyle(el).backgroundColor,
      getComputedStyle(document.documentElement).getPropertyValue("--clr-accent-rgb").trim(),
    ]);
  expect(fill).toBe(`rgb(${accent.split(/\s+/).join(", ")})`);
  const fillBox = (await page.locator(".px-fill").boundingBox())!;
  const meter = (await page.locator(".px-meter").boundingBox())!;
  expect(fillBox.width / meter.width).toBeCloseTo(0.5, 1);
});

test("the bar's frame is quiet: a faint line, no glow", async ({ page }) => {
  await open(page, 5, "in_progress", { prefs: { theme: "dark" } });
  const { alpha, filter } = await page.locator(".px-top").evaluate((el) => {
    const parts = getComputedStyle(el)
      .backgroundColor.match(/[\d.]+/g)!
      .map(Number);
    return {
      alpha: parts.length === 4 ? parts[3] : 1,
      filter: getComputedStyle(el.closest(".boss-bar")!).filter,
    };
  });
  expect(alpha).toBeLessThanOrEqual(0.25);
  expect(filter).toBe("none");
});

const stripes = (page: Page) =>
  page.locator(".px-empty").evaluate((el) => getComputedStyle(el).animationName);

test("the empty side's stripes move with Animations on", async ({ page }) => {
  await open(page, 5, "in_progress");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await expect.poll(() => stripes(page)).toContain("boss-stripes");
});

test("with Animations off, or the system asking for less motion, the stripes stay still", async ({
  page,
}) => {
  await open(page, 5, "in_progress", { motion: false });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  expect(await stripes(page)).toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 5, "in_progress");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  expect(await stripes(page)).toBe("none");
});
