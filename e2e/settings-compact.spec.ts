import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, ipcCalls, item, mockLibrary } from "./fixtures/library";
import {
  openSettingsChoice,
  openSettingsPicker,
  openSettingsSection,
  settingsSection,
} from "./fixtures/settings";

function completed() {
  const entry = item(910001, "movie", "Settings artwork fixture", { runtime_minutes: 90 }, null);
  entry.user.status = "completed";
  entry.user.progress = 1;
  return entry;
}

const writes = async (page: Parameters<typeof ipcCalls>[0]) =>
  (await ipcCalls(page)).filter((call) => call.cmd === "prefs_update");

test("compact settings starts with four closed sections and only current values when expanded", async ({
  page,
}) => {
  await mockLibrary(page, [completed()], { events: eventsAtLevel(3), seenLevel: 25 });
  await page.goto("/settings");
  await expect(page.locator("details.settings-section > summary h2")).toHaveText([
    "Theme",
    "Profile",
    "Preferences",
    "Backup",
  ]);
  await expect(page.locator("details.settings-section[open]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ember", exact: true })).toHaveCount(0);
  await openSettingsSection(page, "Theme");
  await expect(page.locator(".theme-section .picker-trigger")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Accent: Default", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ember", exact: true })).toHaveCount(0);
  await expect(page.locator(".theme-section #profile-artwork")).toHaveCount(0);
  await openSettingsSection(page, "Profile");
  await expect(
    page.getByRole("button", { name: "Profile artwork: Default artwork", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Title: Automatic", exact: true })).toBeVisible();
  await expect(settingsSection(page, "Theme")).toHaveAttribute("open", "");
  await openSettingsSection(page, "Preferences");
  await expect(
    settingsSection(page, "Preferences").getByRole("switch", { name: "Animations" }),
  ).toBeVisible();
  await expect(
    settingsSection(page, "Preferences").getByLabel("Pages per hour (books)"),
  ).toBeVisible();
  await expect(
    settingsSection(page, "Preferences").getByLabel("Minutes per chapter (manga)"),
  ).toBeVisible();
  await expect(
    settingsSection(page, "Preferences").getByLabel("TMDB key", { exact: true }),
  ).toHaveAttribute("type", "password");
  expect(await writes(page)).toEqual([]);
});

test("dropdown keyboard selection closes, restores focus and avoids redundant writes", async ({
  page,
}) => {
  await mockLibrary(page, [], { events: eventsAtLevel(3), seenLevel: 25 });
  await page.goto("/settings");
  await openSettingsSection(page, "Theme");
  const trigger = page.getByRole("button", { name: "Accent: Default", exact: true });
  await trigger.focus();
  await trigger.press("Enter");
  const panel = page.locator('.reward-picker[data-picker="Accent"] [popover]');
  await expect(panel).toBeVisible();
  const normal = panel.getByRole("button", { name: "Default", exact: true });
  await expect(normal).toBeFocused();
  await normal.press("Tab");
  const ember = panel.getByRole("button", { name: "Ember", exact: true });
  await expect(ember).toBeFocused();
  await ember.press("Enter");
  await expect(panel).toBeHidden();
  const active = page.getByRole("button", { name: "Accent: Ember", exact: true });
  await expect(active).toBeFocused();
  expect(await writes(page)).toHaveLength(1);
  const same = await openSettingsChoice(page, "Accent", "Ember");
  const paints = await same.evaluate((node) => {
    const css = getComputedStyle(node);
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--clr-primary)";
    probe.style.color = "var(--clr-on-primary)";
    node.append(probe);
    const wanted = getComputedStyle(probe);
    const result = {
      background: css.backgroundColor,
      color: css.color,
      expectedBackground: wanted.backgroundColor,
      expectedColor: wanted.color,
    };
    probe.remove();
    return result;
  });
  expect(paints.background).toBe(paints.expectedBackground);
  expect(paints.color).toBe(paints.expectedColor);
  await same.press("Enter");
  await expect(panel).toBeHidden();
  expect(await writes(page)).toHaveLength(1);
});

test("dropdown dismisses with Escape or outside click and cannot outlive its accordion", async ({
  page,
}) => {
  await mockLibrary(page, [], { events: eventsAtLevel(25), seenLevel: 25 });
  await page.goto("/settings");
  let panel = await openSettingsPicker(page, "Accent");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Accent: Default", exact: true })).toBeFocused();
  panel = await openSettingsPicker(page, "Accent");
  await page.getByRole("heading", { name: "Settings", exact: true }).click();
  await expect(panel).toBeHidden();
  await openSettingsPicker(page, "Accent");
  const paletteTrigger = page.locator('.reward-picker[data-picker="Palette"] .picker-trigger');
  await paletteTrigger.focus();
  await paletteTrigger.press("Enter");
  const palettes = page.locator('.reward-picker[data-picker="Palette"] [popover]');
  await expect(page.locator('.reward-picker[data-picker="Accent"] [popover]')).toBeHidden();
  await expect(palettes).toBeVisible();
  await settingsSection(page, "Theme").locator(":scope > summary").click();
  await expect
    .poll(() =>
      page
        .locator(".picker-panel")
        .evaluateAll((nodes) => nodes.filter((node) => node.matches(":popover-open")).length),
    )
    .toBe(0);
  expect(await writes(page)).toEqual([]);
});

test("failed dropdown save stays open and keeps the rolled-back effective selection", async ({
  page,
}) => {
  await mockLibrary(page, [], { events: eventsAtLevel(3), seenLevel: 25 });
  await page.goto("/settings");
  const ember = await openSettingsChoice(page, "Accent", "Ember");
  await page.evaluate(() => {
    const internal = (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    const invoke = internal.invoke;
    internal.invoke = (cmd, args) =>
      cmd === "prefs_update" ? Promise.reject("Disk full") : invoke(cmd, args);
  });
  await ember.click();
  await expect(page.getByRole("status", { name: "Theme save" })).toContainText("Disk full");
  const panel = page.locator('.reward-picker[data-picker="Accent"] [popover]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Default", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Accent: Default", exact: true })).toBeVisible();
});

for (const [hash, owner] of [
  ["theme", "Theme"],
  ["titles", "Profile"],
  ["profile-artwork", "Profile"],
] as const) {
  test(`Settings hash ${hash} reveals its parent on initial and same-route navigation`, async ({
    page,
  }) => {
    await mockLibrary(page, [], { events: eventsAtLevel(3), seenLevel: 25 });
    await page.goto(`/settings#${hash}`);
    await expect(settingsSection(page, owner)).toHaveAttribute("open", "");
    await expect(page.locator(`#${hash}`)).toBeVisible();
    await page.goto("/settings");
    await page.reload();
    await expect(page.locator("main.settings")).toBeVisible();
    await expect(page.locator("details.settings-section[open]")).toHaveCount(0);
    await page.evaluate((hash) => {
      const link = document.createElement("a");
      link.href = `/settings#${hash}`;
      link.textContent = "Test Settings destination";
      link.style.cssText = "position:fixed;top:100px;right:10px;z-index:9000";
      document.querySelector("main.settings")!.append(link);
    }, hash);
    await page.getByRole("link", { name: "Test Settings destination", exact: true }).click();
    await expect(settingsSection(page, owner)).toHaveAttribute("open", "");
    await expect(page.locator(`#${hash}`)).toBeVisible();
    expect(await writes(page)).toEqual([]);
  });
}

test("Preferences preserves unsaved API draft across collapse without saving or revealing keys", async ({
  page,
}) => {
  await page.goto("/settings");
  const section = await openSettingsSection(page, "Preferences");
  const input = section.getByLabel("TMDB key", { exact: true });
  await expect(input).toHaveValue("");
  await input.fill("fixture-only-unsaved-key");
  await section.locator(":scope > summary").click();
  await expect(input).toBeHidden();
  await openSettingsSection(page, "Preferences");
  await expect(input).toHaveValue("fixture-only-unsaved-key");
  await expect(input).toHaveAttribute("type", "password");
  expect(await writes(page)).toEqual([]);
});

test("retained relocked choice shows Default in its compact summary without a repair write", async ({
  page,
}) => {
  await mockLibrary(page, [], { seenLevel: 25, prefs: { accent: "ocean", title: "Connoisseur" } });
  await page.goto("/settings");
  await openSettingsSection(page, "Theme");
  await expect(page.getByRole("button", { name: "Accent: Default", exact: true })).toBeVisible();
  const ocean = await openSettingsChoice(page, "Accent", "Ocean");
  await expect(ocean).toBeDisabled();
  await expect(ocean).toHaveAccessibleDescription(/level 20/i);
  await page.keyboard.press("Escape");
  await openSettingsSection(page, "Profile");
  await expect(page.getByRole("button", { name: "Title: Automatic", exact: true })).toBeVisible();
  await expect(page.getByText(/saved choice: connoisseur.*using automatic/i)).toBeVisible();
  expect(await writes(page)).toEqual([]);
});

for (const theme of ["dark", "light"] as const) {
  test(`compact dropdown geometry ${theme} at enlarged text and safe bottom`, async ({
    page,
    isMobile,
  }) => {
    await mockLibrary(page, [completed()], {
      events: eventsAtLevel(25),
      seenLevel: 25,
      prefs: { theme },
    });
    await page.goto("/settings");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "18.4px";
      document.documentElement.style.setProperty("--safe-bottom", "48px");
    });
    const panel = await openSettingsPicker(page, "Profile artwork");
    await expect(panel.locator(".picker-option")).toHaveCount(31);
    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(7);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 7);
    expect(bounds!.y).toBeGreaterThanOrEqual(7);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 48 - 7);
    await panel
      .getByRole("button", { name: "Quest Sigil tier 5", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      panel.getByRole("button", { name: "Quest Sigil tier 5", exact: true }),
    ).toBeVisible();
    if (isMobile) {
      const sizes = await panel.locator(".picker-option").evaluateAll((nodes) =>
        nodes.map((node) => ({
          w: node.getBoundingClientRect().width,
          h: node.getBoundingClientRect().height,
        })),
      );
      expect(sizes.length).toBe(31);
      for (const size of sizes) {
        expect(size.w).toBeGreaterThanOrEqual(44);
        expect(size.h).toBeGreaterThanOrEqual(44);
      }
    }
    expect(await panel.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(
      1,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    expect(await panel.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await writes(page)).toEqual([]);
  });
}

test("artwork dropdown flips above a near-bottom trigger in a 360 by 560 window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(25),
    seenLevel: 25,
    prefs: { theme: "dark" },
  });
  await page.goto("/settings");
  await openSettingsSection(page, "Profile");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "18.4px";
    document.documentElement.style.setProperty("--safe-bottom", "48px");
    const section = document.querySelector('details[data-section="Profile"]')!;
    const spacer = document.createElement("div");
    spacer.style.height = "560px";
    section.before(spacer);
    const tail = document.createElement("div");
    tail.style.height = "560px";
    document.querySelector("main.settings")!.append(tail);
    const trigger = section.querySelector(
      '.reward-picker[data-picker="Profile artwork"] .picker-trigger',
    )!;
    window.scrollBy({ top: trigger.getBoundingClientRect().top - 450, behavior: "instant" });
  });
  const trigger = page.locator('.reward-picker[data-picker="Profile artwork"] .picker-trigger');
  await expect.poll(async () => (await trigger.boundingBox())!.y).toBeGreaterThan(440);
  const triggerBox = (await trigger.boundingBox())!;
  expect(triggerBox.y + triggerBox.height).toBeLessThanOrEqual(512);
  await trigger.click();
  const panel = page.locator('.reward-picker[data-picker="Profile artwork"] [popover]');
  await expect(panel).toBeVisible();
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.y).toBeGreaterThanOrEqual(7);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(triggerBox.y - 5);
  const last = panel.getByRole("button", { name: "Quest Sigil tier 5", exact: true });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
  expect(await writes(page)).toEqual([]);
});
