import { expect, test } from "@playwright/test";
import { mockLibrary } from "./fixtures/library";

const ENTRY = {
  key: "movie:tmdb:1",
  user: { status: "completed", rating: 9, added_at: "2026-09-01T00:00:00Z" },
  snapshot: { title: "Solaris", provider: "tmdb", media_type: "movie", year: 1972 },
};

test.describe("achievements", () => {
  test("a new user is promised the first unlock instead of being offered it", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 1 });
    await page.goto("/profile");

    await expect(page.getByText(/^Next at level 2:/)).toContainText("Bubbles");
    await expect(page.getByRole("button", { name: /^Ember$/ })).toBeHidden();
  });

  test("an earned accent can be equipped and shows as selected", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 3 });
    await page.goto("/profile");

    const ember = page.getByRole("button", { name: /^Ember$/ });
    await ember.click();
    await expect(ember).toHaveAttribute("aria-pressed", "true");

    // The equipped accent reaches the document as a channel override, so the app actually repaints.
    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--clr-primary-rgb"),
    );
    expect(primary).not.toBe("");
  });

  test("the background stays still until the bubbles are unlocked", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 1 });
    await page.goto("/");
    await expect(page.locator(".circles li")).toHaveCount(0);
  });

  test("equipping the bubbles brings the background to life at once", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 2 });
    await page.goto("/profile");

    // The background sits in the layout, so it reacts without a navigation.
    await expect(page.locator(".circles li")).toHaveCount(0);
    await page.getByRole("button", { name: /^Bubbles$/ }).click();
    await expect(page.locator(".circles li").first()).toBeAttached();
  });

  test("an equipped motif really animates, with a keyframe the browser resolved", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      !!isMobile,
      "particles are not drawn on touch: an animated full-screen layer costs 140%+ CPU there",
    );
    await mockLibrary(page, [ENTRY], { seenLevel: 2 });
    await page.goto("/profile");
    await page.getByRole("button", { name: /^Bubbles$/ }).click();
    await expect(page.locator(".circles li").first()).toBeAttached();

    // getAnimations() is empty when the animation names a keyframe that does not exist — which
    // is what happens if the name reaches CSS through an inline style, outside Svelte's scoping.
    const running = await page
      .locator(".circles li")
      .first()
      .evaluate((li) =>
        li.getAnimations().map((a) => ({
          name: (a as CSSAnimation).animationName,
          state: a.playState,
        })),
      );
    expect(running.length).toBeGreaterThan(0);
    expect(running[0].name).toContain("motif-rise");
    expect(running[0].state).toBe("running");
  });

  test("each motif resolves its own keyframe, not one shared animation", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      !!isMobile,
      "particles are not drawn on touch: an animated full-screen layer costs 140%+ CPU there",
    );
    await mockLibrary(page, [ENTRY], { seenLevel: 25 });
    await page.goto("/profile");

    const nameFor = async (label: string) => {
      await page.getByRole("button", { name: label }).click();
      await expect(page.locator(".circles li").first()).toBeAttached();
      return page
        .locator(".circles li")
        .first()
        .evaluate((li) => (li.getAnimations()[0] as CSSAnimation | undefined)?.animationName ?? "");
    };

    expect(await nameFor("Bubbles")).toContain("motif-rise");
    expect(await nameFor("Embers")).toContain("motif-ember");
    expect(await nameFor("Aurora")).toContain("motif-drift");
  });

  test("a locked reward is listed with the level it needs", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 1 });
    await page.goto("/profile");

    const ahead = page.getByRole("heading", { name: "Still ahead" });
    await expect(ahead).toBeVisible();
    await expect(page.getByText("Level 25")).toBeVisible();
  });

  test("the garden sway animates the plants", async ({ page, isMobile }) => {
    test.skip(
      !!isMobile,
      "the sway is desktop-only: animating ten plants costs 126% CPU on a real phone",
    );
    await mockLibrary(page, [ENTRY], { seenLevel: 8 });
    await page.goto("/profile");

    await page
      .getByRole("group", { name: "Garden" })
      .getByRole("button", { name: /^Garden sway$/ })
      .click();
    // In-app navigation, not goto: a reload restarts the IPC fake and forgets the equip.
    await page
      .getByRole("link", { name: /library/i })
      .first()
      .click();
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    const art = page.locator(".garden .plant-art").first();
    await expect(art).toBeAttached();

    const anims = await art.evaluate((el) =>
      el.getAnimations().map((a) => ({
        name: (a as CSSAnimation).animationName,
        state: a.playState,
      })),
    );
    expect(anims.length).toBeGreaterThan(0);
    expect(anims[0].name).toContain("garden-sway");
    expect(anims[0].state).toBe("running");
  });

  test("the garden stays still when the sway is not equipped", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 8 });
    await page.goto("/library");
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Garden" }).click();
    const art = page.locator(".garden .plant-art").first();
    await expect(art).toBeAttached();
    expect(await art.evaluate((el) => el.getAnimations().length)).toBe(0);
  });

  test("the background slot is blocked while animations are off", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 12, motion: false });
    await page.goto("/profile");

    const group = page.getByRole("group", { name: "Background" });
    await expect(group.getByRole("button", { name: /^Bubbles$/ })).toBeDisabled();
    await expect(group.getByRole("button", { name: /^Default$/ })).toBeDisabled();
    await expect(page.getByText(/animations are off/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /settings/i }).first()).toBeVisible();
  });

  test("the colour slots stay usable while animations are off", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { seenLevel: 12, motion: false });
    await page.goto("/profile");

    const accents = page.getByRole("group", { name: "Accent" });
    await expect(accents.getByRole("button", { name: /^Ember$/ })).toBeEnabled();
    await accents.getByRole("button", { name: /^Ember$/ }).click();
    await expect(accents.getByRole("button", { name: /^Ember$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
