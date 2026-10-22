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
});
