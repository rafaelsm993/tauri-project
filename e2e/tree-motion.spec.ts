import { expect, test } from "@playwright/test";
import { eventsAtLevel, mockLibrary } from "./fixtures/library";

for (const motion of [true, false]) {
  test(`visible tree art gets a finite reveal with motion=${motion}`, async ({ page }) => {
    await mockLibrary(page, [], {
      events: eventsAtLevel(8),
      seenLevel: 66,
      motion,
      prefs: { garden: "sway" },
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Object.assign(window, { __mapReveals: [] });
      document.addEventListener("animationstart", (e) => {
        if (e.animationName.includes("runic-reveal")) {
          const target = e.target as Element;
          if (getComputedStyle(target).visibility !== "hidden")
            (window as unknown as { __mapReveals: string[] }).__mapReveals.push(
              target.classList.contains("map-root")
                ? "map-root"
                : (target.getAttribute("class") ?? ""),
            );
        }
      });
    });
    await page.goto("/library");
    await page
      .getByRole("group", { name: "View" })
      .getByRole("button", { name: "Tree", exact: true })
      .click();
    const count = () =>
      page.evaluate(() => (window as unknown as { __mapReveals: string[] }).__mapReveals.length);
    if (motion) await expect.poll(count).toBeGreaterThan(0);
    else expect(await count()).toBe(0);
    await page
      .getByRole("group", { name: "Explore media trees" })
      .getByRole("button", { name: "Books", exact: true })
      .click();
    const artwork = page.locator(".runic-map.media .map-root");
    await expect(artwork).toBeVisible();
    if (motion) {
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as { __mapReveals: string[] }).__mapReveals.includes("map-root"),
          ),
        )
        .toBe(true);
    }
    await expect
      .poll(() =>
        page
          .locator(".runic-map")
          .evaluate(
            (el) =>
              el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
          ),
      )
      .toBe(0);
    const settled = await count();
    await page.waitForTimeout(900);
    expect(await count()).toBe(settled);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await artwork.evaluate((el) => el.getAnimations().length)).toBe(0);
  });
}

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
