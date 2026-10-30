import { openSettingsChoice, openSettingsPicker, openSettingsSection } from "./fixtures/settings";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, ipcCalls, mockLibrary } from "./fixtures/library";

const animations = (page: Page) => page.getByRole("switch", { name: "Animations" });
const themes = (page: Page) => page.getByRole("group", { name: "Theme" });
const bodyColor = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const LIGHT_BG = "rgb(247, 246, 243)";
const DARK_BG = "rgb(0, 0, 0)";

test("local reward thumbnails render their own palette without equipping it", async ({ page }) => {
  await mockLibrary(page, [], { events: eventsAtLevel(3), seenLevel: 25 });
  await page.goto("/settings");
  const ember = await openSettingsChoice(page, "Accent", "Ember");
  const preview = ember.locator(".reward-preview");
  const root = () => page.evaluate(() => document.documentElement.style.cssText);
  await expect(page.getByRole("link", { name: "Profile · Level 3", exact: true })).toBeVisible();
  await expect.poll(root).toContain("color-scheme");
  const before = await root();
  await expect
    .poll(() => preview.locator(".mark").evaluate((e) => getComputedStyle(e).fill))
    .toBe("rgb(199, 102, 18)");
  await ember.hover();
  await ember.focus();
  expect(await root()).toBe(before);
  expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toEqual([]);
  await ember.press("Enter");
  await expect(ember).toHaveAttribute("aria-pressed", "true");
  const normal = await openSettingsChoice(page, "Accent", "Default");
  await expect
    .poll(() => normal.locator(".mark").evaluate((e) => getComputedStyle(e).fill))
    .toBe("rgb(229, 9, 20)");
  const midnight = (await openSettingsChoice(page, "Palette", "Midnight")).locator(
    ".reward-preview",
  );
  await expect
    .poll(() => midnight.locator(".ground").evaluate((e) => getComputedStyle(e).fill))
    .toBe("rgb(8, 10, 18)");
  expect(await preview.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
});

test("reward dropdowns keep one readable column with enlarged phone text", async ({ page }) => {
  await mockLibrary(page, [], { events: eventsAtLevel(25), seenLevel: 25 });
  await page.goto("/settings");
  await page.evaluate(() => (document.documentElement.style.fontSize = "18.4px"));
  for (const name of ["Accent", "Title"] as const) {
    const panel = await openSettingsPicker(page, name);
    const rows = await panel
      .locator(".picker-option")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    expect(rows.length).toBeGreaterThan(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].top).toBeGreaterThanOrEqual(rows[i - 1].bottom);
      expect(rows[i].left).toBeCloseTo(rows[0].left, 0);
    }
    expect(await panel.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(
      1,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
});

test("System palette suitability follows live operating-system theme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await mockLibrary(page, [], {
    events: eventsAtLevel(25),
    seenLevel: 25,
    prefs: { pack: "midnight" },
  });
  await page.goto("/settings");
  const midnight = await openSettingsChoice(page, "Palette", "Midnight");
  await expect(midnight).toBeDisabled();
  await expect(midnight).toHaveAccessibleDescription(/dark theme/i);
  await expect.poll(() => bodyColor(page)).toBe(LIGHT_BG);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(midnight).toBeEnabled();
  await expect(midnight).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => bodyColor(page)).toBe("rgb(8, 10, 18)");
  expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toEqual([]);
});

test("title selection and equipment persist across reload without changing XP", async ({
  page,
}) => {
  await mockLibrary(page, [], { events: eventsAtLevel(3), seenLevel: 25, persistPrefs: true });
  await page.goto("/settings");
  await (await openSettingsChoice(page, "Accent", "Ember")).click();
  await (await openSettingsChoice(page, "Title", "Newcomer")).click();
  await page.reload();
  await openSettingsSection(page, "Theme");
  await expect(page.getByRole("button", { name: "Accent: Ember", exact: true })).toBeVisible();
  await openSettingsSection(page, "Profile");
  await expect(page.getByRole("button", { name: "Title: Newcomer", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Profile · Level 3", exact: true }).click();
  const level = page.getByRole("region", { name: "Level" });
  await expect(level.getByText("Newcomer", { exact: true })).toBeVisible();
  await expect(level.getByRole("img", { name: /Level 3,/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Achievements", exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Accent", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Settings", exact: true }).last().click();
  await (await openSettingsChoice(page, "Title", "Automatic")).click();
  await page.getByRole("link", { name: "Profile · Level 3", exact: true }).click();
  await expect(level.getByText("Curious Mind", { exact: true })).toBeVisible();
});

test("Settings explains stale selections without writing replacement preferences", async ({
  page,
}) => {
  await mockLibrary(page, [], { seenLevel: 25, prefs: { accent: "ocean", title: "Connoisseur" } });
  await page.goto("/settings");
  await expect(await openSettingsChoice(page, "Accent", "Ocean")).toBeDisabled();
  await expect(await openSettingsChoice(page, "Title", "Connoisseur")).toBeDisabled();
  await expect(page.getByText(/saved choice: ocean.*using default/i)).toBeVisible();
  await expect(page.getByText(/saved choice: connoisseur.*using automatic/i)).toBeVisible();
  expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toEqual([]);
});

test("failed Settings saves report their error and restore the selected option", async ({
  page,
}) => {
  await mockLibrary(page, [], { events: eventsAtLevel(3), seenLevel: 25 });
  await page.goto("/settings");
  await expect(await openSettingsChoice(page, "Accent", "Ember")).toBeEnabled();
  await page.evaluate(() => {
    const internal = (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    const invoke = internal.invoke;
    internal.invoke = (cmd, args) =>
      cmd === "prefs_update" ? Promise.reject("disk full") : invoke(cmd, args);
  });
  await (await openSettingsChoice(page, "Accent", "Ember")).click();
  await expect(page.getByRole("status", { name: "Theme save" })).toContainText("disk full");
  await expect(await openSettingsChoice(page, "Accent", "Default")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await (await openSettingsChoice(page, "Title", "Newcomer")).click();
  await expect(page.getByRole("status", { name: "Title save" })).toContainText("disk full");
  await expect(await openSettingsChoice(page, "Title", "Automatic")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("reward controls fit touch targets and remain static with reduced motion", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockLibrary(page, [], { events: eventsAtLevel(25), seenLevel: 25 });
  await page.goto("/settings");
  const bubbles = await openSettingsChoice(page, "Background", "Bubbles");
  await expect(bubbles).toBeDisabled();
  await expect(bubbles).toHaveAccessibleDescription(/available.*reduced/i);
  await expect(await openSettingsChoice(page, "Accent", "Ember")).toBeEnabled();
  await expect(await openSettingsChoice(page, "Title", "Curious Mind")).toBeEnabled();
  if (isMobile) {
    for (const r of await page
      .locator(".picker-trigger:visible,.picker-panel:popover-open .picker-option")
      .evaluateAll((es) =>
        es.map((e) => ({
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        })),
      )) {
      expect(r.w).toBeGreaterThanOrEqual(44);
      expect(r.h).toBeGreaterThanOrEqual(44);
    }
  }
  expect(
    await page
      .locator(".reward-preview")
      .evaluateAll((es) => es.reduce((n, e) => n + e.getAnimations({ subtree: true }).length, 0)),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
});

test("turning animations off saves it and pauses the background", async ({ page }) => {
  await page.goto("/settings");
  await openSettingsSection(page, "Preferences");
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
  await openSettingsSection(page, "Preferences");
  await animations(page).click();
  await expect(animations(page)).toHaveAttribute("aria-checked", "false");
  await animations(page).press("Space");
  await expect(animations(page)).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".bg-area")).not.toHaveClass(/paused/);
});

test("settings controls are touch-sized on coarse pointers", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mouse viewports may use compact targets");
  await page.goto("/settings");
  await openSettingsSection(page, "Preferences");
  await openSettingsSection(page, "Theme");
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
  await openSettingsSection(page, "Theme");
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
    localStorage.setItem("sesh.theme", "light");
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __boot: string | undefined }).__boot =
        document.documentElement.dataset.theme;
    });
  });
  await page.goto("/settings");
  const boot = await page.evaluate(() => (window as unknown as { __boot?: string }).__boot);
  expect(boot).toBe("light");
});

test("Animations off stops every CSS animation", async ({ page }) => {
  await page.goto("/settings");
  await openSettingsSection(page, "Preferences");
  await animations(page).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  const iterations = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.animation = "x 1s infinite";
    const value = getComputedStyle(probe).animationIterationCount;
    probe.remove();
    return value;
  });
  expect(iterations).toBe("1");
});
