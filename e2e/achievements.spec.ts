import { openSettingsChoice, openSettingsPicker, openSettingsSection } from "./fixtures/settings";
import { expect, test } from "@playwright/test";
import { eventsAtLevel, item, mockLibrary } from "./fixtures/library";

const ENTRY = item(1, "movie", "Solaris", { runtime_minutes: 100 }, null);
ENTRY.user.status = "completed";
ENTRY.user.progress = 1;

test.describe("achievements", () => {
  test("a new user is promised the first unlock instead of being offered it", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(1), seenLevel: 1 });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");

    await expect(page.getByText(/^Next at level 2:/)).toContainText("Bubbles");
    await expect(await openSettingsChoice(page, "Accent", "Ember")).toBeDisabled();
  });

  test("an earned accent can be equipped and shows as selected", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(3), seenLevel: 3 });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");

    const ember = await openSettingsChoice(page, "Accent", "Ember");
    await ember.click();
    await expect(ember).toHaveAttribute("aria-pressed", "true");

    // The equipped accent reaches the document as a channel override, so the app actually repaints.
    const primary = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--clr-primary-rgb"),
    );
    expect(primary).not.toBe("");
  });

  test("the background stays still until the bubbles are unlocked", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(1), seenLevel: 1 });
    await page.goto("/");
    await expect(page.locator(".circles li")).toHaveCount(0);
  });

  test("equipping the bubbles brings the background to life at once", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(2), seenLevel: 2 });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");

    // The background sits in the layout, so it reacts without a navigation.
    await expect(page.locator(".circles li")).toHaveCount(0);
    await (await openSettingsChoice(page, "Background", "Bubbles")).click();
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
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(2), seenLevel: 2 });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");
    await (await openSettingsChoice(page, "Background", "Bubbles")).click();
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
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(25), seenLevel: 25 });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");

    const nameFor = async (label: string) => {
      await (await openSettingsChoice(page, "Background", label)).click();
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
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(1), seenLevel: 1 });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");

    const midnight = await openSettingsChoice(page, "Palette", "Midnight");
    await expect(midnight).toBeDisabled();
    await expect(midnight).toHaveAccessibleDescription(/level 25/i);
    await expect(midnight.locator(".reward-preview")).toBeVisible();
  });

  test("a saved shimmer stays off with Animations off or reduced", async ({ page }) => {
    await mockLibrary(page, [ENTRY], {
      events: eventsAtLevel(8),
      seenLevel: 50,
      motion: false,
      prefs: { garden: "sway" },
    });
    await page.goto("/library");
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Tree" }).click();
    await expect(page.locator(".progression-tree")).not.toHaveClass(/shimmer/);
    expect(
      await page.locator(".tree-crown .rune").evaluate((el) => el.getAnimations().length),
    ).toBe(0);
  });

  test("the background slot is blocked while animations are off", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(12), seenLevel: 12, motion: false });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");

    await openSettingsPicker(page, "Background");
    const group = page.getByRole("group", { name: "Background" });
    await expect(group.getByRole("button", { name: /^Bubbles$/ })).toBeDisabled();
    await expect(group.getByRole("button", { name: /^Default$/ })).toBeDisabled();
    await expect(page.getByText(/animations are off/i).first()).toBeVisible();
    await openSettingsSection(page, "Preferences");
    await expect(page.getByRole("switch", { name: "Animations" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("the colour slots stay usable while animations are off", async ({ page }) => {
    await mockLibrary(page, [ENTRY], { events: eventsAtLevel(12), seenLevel: 12, motion: false });
    await page.goto("/settings");
    await openSettingsSection(page, "Theme");

    await openSettingsPicker(page, "Accent");
    const accents = page.getByRole("group", { name: "Accent" });
    await expect(accents.getByRole("button", { name: /^Ember$/ })).toBeEnabled();
    await accents.getByRole("button", { name: /^Ember$/ }).click();
    await expect(
      accents.getByRole("button", { name: /^Ember$/, includeHidden: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
