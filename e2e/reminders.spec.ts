import { expect, test, type Page } from "@playwright/test";
import { ipcCalls, item, mockLibrary } from "./fixtures/library";

// Thursday Oct 1, 10:00 local; Frieren plays Mon–Thu, Hades only on weekends.
const MON_THU = { days: [0, 1, 2, 3], max_session_minutes: 45, since: "2026-09-28" };
const FRIEREN = item(1, "anime", "Frieren", { episodes: 28, episode_minutes: 24 }, MON_THU);
const HADES = item(
  2,
  "game",
  "Hades",
  { hours: 20 },
  { days: [5, 6], max_session_minutes: 120, since: "2026-09-28" },
);
const LIBRARY = [FRIEREN, HADES];

// Progress on Monday only: Tuesday and Wednesday were re-planned.
const MONDAY = {
  id: "m1",
  kind: "library_update",
  media_key: FRIEREN.key,
  at_utc: "2026-09-28T20:00:00Z",
  local_date: "2026-09-28",
  payload: { progress: 2 },
};

const reminder = (page: Page) => page.getByRole("status", { name: "Reminder" });
const continueRow = (page: Page) => page.getByRole("region", { name: "Continue" });
const card = (page: Page, title: string) =>
  continueRow(page).getByRole("listitem").filter({ hasText: title });
const SHAME = /behind|late\b|overdue|missed|fail/i;

const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

test("opening the app shows today's session once, as a toast and on Home", async ({ page }) => {
  await mockLibrary(page, LIBRARY, { events: [MONDAY] });
  await page.goto("/");
  await expect(reminder(page)).toContainText("45 min of Frieren planned for today");
  await expect(continueRow(page).getByRole("listitem").first()).toContainText("Frieren");
  await expect(card(page, "Frieren")).toContainText("45 min today");
  await expect(continueRow(page)).toContainText("2 earlier sessions re-planned");
  // Hades is planned for weekends only: today it has no time to show.
  await expect(continueRow(page).getByText(/min today$/)).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(SHAME);
});

test("Later keeps the toast away for three hours, then it may return", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.clock.install({ time: new Date("2026-10-01T10:00:00") });
  await page.goto("/");
  await reminder(page).getByRole("button", { name: "Later" }).click();
  await expect(reminder(page)).toBeEmpty();
  await expect(card(page, "Frieren")).toContainText("45 min today");
  await page.clock.fastForward("02:00:00");
  await focus(page);
  await expect(reminder(page)).toBeEmpty();
  await page.clock.fastForward("01:01:00");
  await focus(page);
  await expect(reminder(page)).toContainText("Frieren");
});

test("Log session from Continue closes the reminder and clears today's time", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/");
  await expect(reminder(page)).toContainText("Frieren");
  await card(page, "Frieren").getByRole("button", { name: "Log a session of Frieren" }).click();
  await page
    .getByRole("dialog", { name: "Log a session of Frieren" })
    .getByRole("button", { name: "Log session", exact: true })
    .click();
  await expect(reminder(page)).toBeEmpty();
  await expect(card(page, "Frieren")).not.toContainText("min today");
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ key: FRIEREN.key, patch: { progress: 2 } });
});

test("a Planning item with a session today leads Continue", async ({ page }) => {
  // Continue lists In progress only; without this its Log session would be nowhere on Home.
  const PLANNED = { ...FRIEREN, user: { ...FRIEREN.user, status: "planning" } };
  await mockLibrary(page, [PLANNED, HADES]);
  await page.goto("/");
  await expect(continueRow(page).getByRole("listitem").first()).toContainText("Frieren");
  await card(page, "Frieren").getByRole("button", { name: "Log a session of Frieren" }).click();
  await page
    .getByRole("dialog", { name: "Log a session of Frieren" })
    .getByRole("button", { name: "Log session", exact: true })
    .click();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ patch: { progress: 2, status: "in_progress" } });
});

test("Log session on a Library card confirms, then saves the progress", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/library");
  await expect(page.getByText("45 min today")).toBeVisible();
  await page.getByRole("button", { name: "Log a session of Frieren" }).click();
  const sheet = page.getByRole("dialog", { name: "Log a session of Frieren" });
  await expect(sheet.getByLabel("Session length (minutes)")).toHaveValue("45");
  // The cursor stays out of the field: on a phone the keyboard would cover the rest.
  await expect(sheet).toBeFocused();
  await expect(sheet).toContainText("+2 episodes · 2 of 28 episodes");
  await expect(sheet).toContainText("14 sessions · 10 h 24 min");
  // 45 min is 1.875 episodes: the user may record 1 instead.
  await sheet.getByRole("button", { name: "Round down · 1 episode" }).click();
  await expect(sheet).toContainText("+1 episode · 1 of 28 episodes");
  await sheet.getByRole("button", { name: "Round up · 2 episodes" }).click();
  await sheet.getByRole("button", { name: "Log session", exact: true }).click();
  await expect(sheet).toBeHidden();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ key: FRIEREN.key, patch: { progress: 2 } });
  // Logged: today's session is done, so its time note goes.
  await expect(page.getByText("45 min today")).toHaveCount(0);
});

test("a session on an unplanned day says so and still counts", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/library");
  // Frieren's reminder floats over the last row on a small phone; a person closes it first.
  await reminder(page).getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Log a session of Hades" }).click();
  const sheet = page.getByRole("dialog", { name: "Log a session of Hades" });
  await expect(sheet.getByRole("note")).toContainText("isn't one of the days you planned");
  await expect(sheet.getByLabel("Session length (minutes)")).toHaveValue("120");
  await sheet.getByRole("button", { name: "Log session", exact: true }).click();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ key: HADES.key, patch: { progress: 2 } });
});

test("the cover icon plans an unplanned item", async ({ page }) => {
  const LOOSE = item(5, "tv", "Arcane", { episodes: 9, episode_minutes: 40 }, null);
  await mockLibrary(page, [LOOSE]);
  await page.goto("/library");
  await expect(page.getByRole("button", { name: "Log a session of Arcane" })).toHaveCount(0);
  await page.getByRole("button", { name: "Plan Arcane" }).click();
  await expect(page.getByRole("dialog", { name: "Plan Arcane" })).toBeVisible();
});

test("logging the last session completes the item", async ({ page }) => {
  const DUNE = item(3, "book", "Dune", { pages: 600 }, MON_THU);
  const NEARLY = { ...DUNE, user: { ...DUNE.user, progress: 590 } };
  await mockLibrary(page, [NEARLY]);
  await page.goto("/library");
  await page.getByRole("button", { name: "Log a session of Dune" }).click();
  const sheet = page.getByRole("dialog", { name: "Log a session of Dune" });
  await expect(sheet).toContainText("this finishes it");
  await sheet.getByRole("button", { name: "Log session", exact: true }).click();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ patch: { progress: 600, status: "completed" } });
});

test("Start opens the item", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/");
  await reminder(page).getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/media\/anime\/1$/);
  await expect(reminder(page)).toBeEmpty();
});

test("a level-up goes first; the reminder follows when it closes", async ({ page }) => {
  const XP = [11, 12, 13].map((n) => ({
    id: `x${n}`,
    kind: "library_add",
    media_key: `tmdb:movie:${n}`,
    at_utc: "2026-09-20T12:00:00Z",
    local_date: "2026-09-20",
    payload: { status: "completed", rating: 9 },
  }));
  await mockLibrary(page, LIBRARY, { events: XP, seenLevel: 1 });
  await page.goto("/");
  const levelUp = page.getByRole("status", { name: "Level up" });
  await expect(levelUp).toContainText("Level");
  await expect(reminder(page)).toBeEmpty();
  await levelUp.getByRole("button", { name: "Close" }).click();
  await expect(reminder(page)).toContainText("Frieren");
});

test("nothing planned for today means no toast and no time for today", async ({ page }) => {
  await mockLibrary(page, [HADES]);
  await page.goto("/");
  await expect(card(page, "Hades")).toBeVisible();
  await expect(page.getByText(/min today$/)).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(reminder(page)).toBeEmpty();
});

test("nothing is checked while the app is in the background", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.clock.install({ time: new Date("2026-10-01T10:00:00") });
  await page.goto("/");
  await reminder(page).getByRole("button", { name: "Close reminder" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward("04:00:00");
  await focus(page);
  await expect(reminder(page)).toBeEmpty();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(reminder(page)).toContainText("Frieren");
});

test("the toast and card buttons are touch-sized and fit", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch targets apply to coarse pointers");
  const THU = { days: [3], max_session_minutes: 60, since: "2026-09-28" };
  const busy = [
    item(3, "book", "Dune", { pages: 600 }, THU),
    item(4, "tv", "Arcane", { episodes: 9, episode_minutes: 40 }, THU),
  ];
  await mockLibrary(page, [...LIBRARY, ...busy]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(reminder(page)).toContainText("Arcane");
  const buttons = [
    reminder(page).getByRole("button", { name: "Start" }),
    reminder(page).getByRole("button", { name: "Later" }),
    reminder(page).getByRole("button", { name: "Close reminder" }),
    card(page, "Frieren").getByRole("button", { name: "Log a session of Frieren" }),
  ];
  for (const b of buttons) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const width = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(width).toBeLessThanOrEqual(0);
  const c = (await card(page, "Frieren").boundingBox())!;
  const log = (await buttons[3].boundingBox())!;
  expect(log.x + log.width, "Log session spills out of its card").toBeLessThanOrEqual(
    c.x + c.width + 1,
  );
  // The cover icon is 30px to the eye; its hit area reaches 44px.
  const iconButton = card(page, "Frieren").getByRole("button", { name: "Edit plan for Frieren" });
  // Further along the rail on a phone: hit-testing only sees what is on screen.
  await iconButton.scrollIntoViewIfNeeded();
  const icon = (await iconButton.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"),
    [icon.x + icon.width / 2, icon.y + icon.height + 6],
  );
  expect(hit, "the plan icon is too small to hit").toBe("Edit plan for Frieren");
  const box = (await reminder(page).locator(".toast").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
