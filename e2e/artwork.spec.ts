import { openSettingsChoice, openSettingsPicker } from "./fixtures/settings";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, ipcCalls, item, mockLibrary } from "./fixtures/library";

for (const kind of ["activity", "library"])
  test(`failed ${kind} reload cannot display stale artwork in either destination`, async ({
    page,
  }) => {
    const sources: string[] = [];
    page.on("request", (request) => sources.push(request.url()));
    await mockLibrary(page, [completed()], {
      events: eventsAtLevel(3),
      seenLevel: 25,
      prefs: { profile_art: "movie:1" },
    });
    await page.goto("/profile");
    await expect(
      page.getByRole("region", { name: "Level" }).locator(".profile-artwork"),
    ).toHaveCount(1);
    const source = sources.find((url) =>
      url.includes(`/src/lib/stores/${kind === "activity" ? "gamification" : "library"}.svelte.ts`),
    );
    if (!source) throw new Error("Missing loaded store");
    await page.evaluate(
      async ({ source, kind }) => {
        const mod = await import(/* @vite-ignore */ source);
        const ipc = (
          window as unknown as {
            __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
          }
        ).__TAURI_INTERNALS__;
        const invoke = ipc.invoke;
        const failed = kind === "activity" ? "library_events" : "library_load";
        ipc.invoke = (cmd, args) =>
          cmd === failed ? Promise.reject(`${kind} unreadable`) : invoke(cmd, args);
        if (kind === "activity") await mod.gamificationStore.load({ quiet: true });
        else await mod.libraryStore.reload();
      },
      { source, kind },
    );
    await expect(profile(page).locator(".profile-artwork")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Level" }).locator(".profile-artwork"),
    ).toHaveCount(0);
    expect(await stored(page)).toMatchObject({ profile_art: "movie:1" });
    expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toEqual([]);
  });

function completed() {
  const e = item(900000, "movie", "Artwork test film", { runtime_minutes: 100 }, null);
  e.user.status = "completed";
  e.user.progress = 1;
  return e;
}
const profile = (page: Page) => page.locator(".app-nav .profile");
const stored = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<Record<string, unknown>> };
      }
    ).__TAURI_INTERNALS__.invoke("prefs_load"),
  );

test("artwork equips from Profile settings and persists in Profile and navigation without changing XP", async ({
  page,
}) => {
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    persistPrefs: true,
  });
  await page.goto("/settings");
  await openSettingsPicker(page, "Avatar");
  const art = await openSettingsChoice(page, "Avatar", "Silver Screen tier 1");
  await expect(art).toBeEnabled();
  expect(
    await page
      .locator('.artwork-section .picker-option:not([aria-label="Default avatar"])')
      .count(),
  ).toBe(1);
  await art.hover();
  await art.focus();
  expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toEqual([]);
  await art.press("Enter");
  await expect(art).toHaveAttribute("aria-pressed", "true");
  await expect(profile(page).locator(".profile-artwork")).toHaveAttribute("width", "24");
  await expect(profile(page).locator(".level-ring")).toHaveCount(1);
  await page.reload();
  await expect(art).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Profile · Level 3", exact: true }).click();
  const level = page.getByRole("region", { name: "Level" });
  await expect(level.locator(".ring .profile-artwork")).toHaveAttribute("width", "64");
  await expect(level.getByRole("img", { name: /^Level 3,/ })).toBeVisible();
  const before = await level.locator(".level-xp").innerText();
  await page.getByRole("link", { name: "Settings", exact: true }).last().click();
  await (await openSettingsChoice(page, "Avatar", "Default avatar")).click();
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(0);
  await page.getByRole("link", { name: "Profile · Level 3", exact: true }).click();
  await expect(level.locator(".level-xp")).toHaveText(before);
  await expect(level.locator(".profile-artwork")).toHaveCount(0);
});

test("uncompletion relocks artwork even though completion XP remains and re-completion restores it", async ({
  page,
}) => {
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    prefs: { profile_art: "movie:1" },
  });
  await page.goto("/media/movie/900000");
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(1);
  await page.getByRole("button", { name: "Watched", exact: true }).click();
  await expect(page.getByText("Status: Planning", { exact: true })).toBeVisible();
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Profile · Level 3", exact: true })).toBeVisible();
  expect(await stored(page)).toMatchObject({ profile_art: "movie:1" });
  await page.getByRole("button", { name: "Watched", exact: true }).click();
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(1);
  expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toEqual([]);
});

test("removal retracts count and art without clearing the saved choice", async ({ page }) => {
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    prefs: { profile_art: "movie:1" },
  });
  await page.goto("/media/movie/900000");
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(0);
  await page.getByRole("link", { name: "Profile · Level 2", exact: true }).click();
  await expect(page.getByRole("region", { name: "Level" }).locator(".profile-artwork")).toHaveCount(
    0,
  );
  expect(await stored(page)).toMatchObject({ profile_art: "movie:1" });
});

test("unknown saved art has a default glyph and an explanation, never a repair write", async ({
  page,
}) => {
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    prefs: { profile_art: "future:99" },
  });
  await page.goto("/settings");
  await openSettingsPicker(page, "Avatar");
  await expect(page.getByText(/Saved choice: future:99/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Default avatar", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(0);
  expect((await ipcCalls(page)).filter((c) => c.cmd === "prefs_update")).toEqual([]);
});

test("artwork keeps native sizes and follows a live accent in nav, Profile and previews", async ({
  page,
  viewport,
}) => {
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    prefs: { profile_art: "movie:1", theme: "dark" },
  });
  await page.goto("/settings");
  await openSettingsPicker(page, "Avatar");
  const nav = profile(page).locator(".profile-artwork");
  await expect(nav).toHaveCount(1);
  const tonesBefore = await nav
    .locator("path")
    .evaluateAll((paths) => paths.map((e) => getComputedStyle(e).fill));
  await (await openSettingsChoice(page, "Accent", "Ember")).click();
  await openSettingsPicker(page, "Avatar");
  await expect
    .poll(() => nav.locator(".accent").evaluate((e) => getComputedStyle(e).fill))
    .toBe(viewport!.width <= 768 ? "rgb(28, 18, 8)" : "rgb(199, 102, 18)");
  const tonesAfter = await nav
    .locator("path")
    .evaluateAll((paths) => paths.map((e) => getComputedStyle(e).fill));
  expect(new Set(tonesAfter).size).toBe(5);
  for (let i = 0; i < 5; i++) expect(tonesAfter[i]).not.toBe(tonesBefore[i]);
  await expect
    .poll(() =>
      page
        .getByRole("button", { name: "Silver Screen tier 1", exact: true })
        .locator(".accent")
        .evaluate((e) => getComputedStyle(e).fill),
    )
    .toBe("rgb(199, 102, 18)");
  await page.evaluate(() => (document.documentElement.style.fontSize = "18.4px"));
  const panel = page.locator(".artwork-section .picker-panel");
  await expect(panel.locator(".picker-option")).toHaveCount(2);
  expect(await panel.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(
    1,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await page.getByRole("link", { name: "Profile · Level 3", exact: true }).click();
  const art = page.getByRole("region", { name: "Level" }).locator(".profile-artwork");
  await expect
    .poll(() => art.locator(".accent").evaluate((e) => getComputedStyle(e).fill))
    .toBe("rgb(199, 102, 18)");
  expect(await art.evaluate((e) => e.getAnimations().length)).toBe(0);
  expect(await art.evaluate((e) => e.getBoundingClientRect().width)).toBe(64);
  expect(
    await art.evaluate((e) => {
      const a = e.getBoundingClientRect();
      const p = e.parentElement!.getBoundingClientRect();
      return Math.abs(a.left + a.width / 2 - p.left - p.width / 2);
    }),
  ).toBeLessThan(1);
  expect(await nav.evaluate((e) => e.getBoundingClientRect().width)).toBe(24);
});

test("failed artwork save reports the error and restores Default everywhere", async ({ page }) => {
  await mockLibrary(page, [completed()], { events: eventsAtLevel(3), seenLevel: 25 });
  await page.goto("/settings");
  await openSettingsPicker(page, "Avatar");
  await expect(
    page.getByRole("button", { name: "Silver Screen tier 1", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const ipc = (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    const invoke = ipc.invoke;
    ipc.invoke = (cmd, args) =>
      cmd === "prefs_update" ? Promise.reject("Disk full") : invoke(cmd, args);
  });
  await page.getByRole("button", { name: "Silver Screen tier 1", exact: true }).click();
  await expect(page.getByRole("status", { name: "Artwork save" })).toHaveText(/Disk full/);
  await expect(page.getByRole("button", { name: "Default avatar", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(profile(page).locator(".profile-artwork")).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ profile_art: "default" });
});

test("Avatar is an earned image grid; locked art belongs to the tree", async ({ page }) => {
  await mockLibrary(page, [completed()], { events: eventsAtLevel(3), seenLevel: 3 });
  await page.goto("/settings");
  const panel = await openSettingsPicker(page, "Avatar");
  await expect(panel.locator(".picker-option")).toHaveCount(2);
  await expect(
    panel.getByRole("button", { name: "Silver Screen tier 2", exact: true }),
  ).toHaveCount(0);
  for (const name of ["Default avatar", "Silver Screen tier 1"]) {
    const b = panel.getByRole("button", { name, exact: true });
    await expect(b.locator("svg")).toBeVisible();
    const copy = b.locator(".option-copy");
    expect((await copy.boundingBox())!.width).toBeLessThanOrEqual(1);
  }
  await panel.getByRole("button", { name: "Silver Screen tier 1" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".app-nav .profile .profile-artwork")).toBeVisible();
});
