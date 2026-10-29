import { expect, test } from "@playwright/test";
import { eventsAtLevel, mockLibrary } from "./fixtures/library";
import { openSettingsChoice, openSettingsSection } from "./fixtures/settings";

for (const motif of ["bubbles", "embers", "aurora"]) {
  test(`${motif} really moves in the selected renderer`, async ({ page }) => {
    await mockLibrary(page, [], { events: eventsAtLevel(25), seenLevel: 25, prefs: { motif } });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/settings");
    await page.bringToFront();
    const touch = await page.evaluate(() => matchMedia("(hover: none), (pointer: coarse)").matches);
    if (touch) {
      const canvas = page.locator("canvas.mobile-motif");
      await expect(canvas).toBeVisible();
      await expect
        .poll(() =>
          canvas.evaluate((el: HTMLCanvasElement) => {
            const c = el.getContext("2d")!;
            return c
              .getImageData(0, 0, el.width, el.height)
              .data.some((n, i) => i % 4 === 3 && n > 0);
          }),
        )
        .toBe(true);
      const frame = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
      await expect
        .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL()))
        .not.toBe(frame);
      expect(await canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBeLessThanOrEqual(240);
      expect(await canvas.evaluate((el: HTMLCanvasElement) => el.height)).toBeLessThanOrEqual(480);
      await expect(page.locator(".circles")).toHaveCSS("display", "none");
    } else {
      const particle = page.locator(".circles li").first();
      await expect(particle).toBeVisible();
      await expect
        .poll(() =>
          particle.evaluate(
            (el) => el.getAnimations().filter((a) => a.playState === "running").length,
          ),
        )
        .toBeGreaterThan(0);
      const frame = await particle.evaluate((el) => getComputedStyle(el).transform);
      await expect
        .poll(() => particle.evaluate((el) => getComputedStyle(el).transform))
        .not.toBe(frame);
      await expect(page.locator("canvas.mobile-motif")).toHaveCount(0);
    }
  });
}

test("motion off, reduced motion, blur and Default cannot keep a mobile frame loop alive", async ({
  page,
}) => {
  await mockLibrary(page, [], {
    events: eventsAtLevel(25),
    seenLevel: 25,
    prefs: { motif: "embers" },
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/settings");
  await page.bringToFront();
  const touch = await page.evaluate(() => matchMedia("(hover: none), (pointer: coarse)").matches);
  test.skip(!touch, "mobile renderer lifecycle; desktop CSS motion has separate coverage");
  const canvas = page.locator("canvas.mobile-motif");
  await expect(canvas).toBeVisible();
  const old = (await canvas.elementHandle())!;
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(canvas).toHaveCount(0);
  const stoppedFrame = await old.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  await page.waitForTimeout(400);
  expect(await old.evaluate((el: HTMLCanvasElement) => el.toDataURL())).toBe(stoppedFrame);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(canvas).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(canvas).toBeVisible();
  await openSettingsSection(page, "Preferences");
  await page.getByRole("switch", { name: "Animations" }).click();
  await expect(canvas).toHaveCount(0);
  await page.getByRole("switch", { name: "Animations" }).click();
  await expect(canvas).toBeVisible();
  await (await openSettingsChoice(page, "Background", "Default")).click();
  await expect(canvas).toHaveCount(0);
  await old.dispose();
});

for (const motif of ["bubbles", "embers", "aurora"]) {
  test(`${motif} redraws smoothly rather than in eight-fps steps`, async ({ page }) => {
    await mockLibrary(page, [], { events: eventsAtLevel(25), seenLevel: 25, prefs: { motif } });
    await page.goto("/profile");
    await page.bringToFront();
    test.skip(
      !(await page.evaluate(() => matchMedia("(hover: none), (pointer: coarse)").matches)),
      "touch renderer pacing",
    );
    const canvas = page.locator("canvas.mobile-motif");
    await expect(canvas).toBeVisible();
    const pacing = await canvas.evaluate(async (el: HTMLCanvasElement) => {
      const ctx = el.getContext("2d")!;
      const clear = ctx.clearRect;
      const times: number[] = [];
      ctx.clearRect = function (...args) {
        times.push(performance.now());
        return clear.apply(this, args);
      };
      try {
        await new Promise((r) => setTimeout(r, 1600));
        const intervals = times
          .slice(1)
          .map((t, i) => t - times[i])
          .sort((a, b) => a - b);
        return {
          frames: times.length,
          median: intervals[Math.floor(intervals.length / 2)] ?? Infinity,
        };
      } finally {
        ctx.clearRect = clear;
      }
    });
    expect(pacing.frames).toBeGreaterThanOrEqual(32);
    expect(pacing.median).toBeLessThan(55);
  });
}

test("unearned saved motif stays inactive despite a high seen level", async ({ page }) => {
  await mockLibrary(page, [], {
    events: eventsAtLevel(1),
    seenLevel: 66,
    prefs: { motif: "aurora" },
  });
  await page.goto("/settings");
  await expect(page.locator(".circles li")).toHaveCount(0);
  await expect(page.locator("canvas.mobile-motif")).toHaveCount(0);
});

test("the app marks itself paused while the window is unfocused", async ({ page }) => {
  await mockLibrary(page, [], { events: eventsAtLevel(8), seenLevel: 8 });
  await page.goto("/");
  await page.bringToFront();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-ambient", "running");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(html).toHaveAttribute("data-ambient", "paused");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(html).toHaveAttribute("data-ambient", "running");
});
