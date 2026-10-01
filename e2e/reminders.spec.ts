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
const today = (page: Page) => page.getByRole("region", { name: "Today" });
const SHAME = /behind|late\b|overdue|missed|fail/i;

const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

test("opening the app shows today's session once, as a toast and on Home", async ({ page }) => {
  await mockLibrary(page, LIBRARY, { events: [MONDAY] });
  await page.goto("/");
  await expect(reminder(page)).toContainText("45 min of Frieren planned for today");
  await expect(today(page).getByRole("listitem")).toHaveCount(1);
  await expect(today(page)).toContainText("Frieren");
  await expect(today(page)).toContainText("2 earlier sessions re-planned");
  await expect(today(page)).not.toContainText("Hades");
  await expect(page.locator("body")).not.toContainText(SHAME);
});

test("Later keeps the toast away for three hours, then it may return", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.clock.install({ time: new Date("2026-10-01T10:00:00") });
  await page.goto("/");
  await reminder(page).getByRole("button", { name: "Later" }).click();
  await expect(reminder(page)).toBeEmpty();
  await expect(today(page)).toContainText("Frieren");
  await page.clock.fastForward("02:00:00");
  await focus(page);
  await expect(reminder(page)).toBeEmpty();
  await page.clock.fastForward("01:01:00");
  await focus(page);
  await expect(reminder(page)).toContainText("Frieren");
});

test("Done in the strip resumes the plan tomorrow and clears the session", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/");
  await expect(reminder(page)).toContainText("Frieren");
  await today(page).getByRole("button", { name: "Done: Frieren" }).click();
  await expect(page.getByRole("region", { name: "Today" })).toHaveCount(0);
  await expect(reminder(page)).toBeEmpty();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({
    key: FRIEREN.key,
    patch: { plan: { ...MON_THU, since: "2026-10-02" } },
  });
});

test("Next session in the Library strip saves the same way", async ({ page }) => {
  await mockLibrary(page, LIBRARY);
  await page.goto("/library");
  await today(page).getByRole("button", { name: "Next session: Frieren" }).click();
  await expect(page.getByRole("region", { name: "Today" })).toHaveCount(0);
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

test("nothing planned for today means no toast and no strip", async ({ page }) => {
  await mockLibrary(page, [HADES]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today" })).toHaveCount(0);
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

test("the toast and strip buttons are touch-sized and the strip fits", async ({
  page,
  isMobile,
}) => {
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
    today(page).getByRole("button", { name: "Done: Frieren" }),
    today(page).getByRole("button", { name: "Next session: Frieren" }),
  ];
  for (const b of buttons) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const width = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(width).toBeLessThanOrEqual(0);
  const strip = (await today(page).boundingBox())!;
  expect(strip.x).toBeGreaterThanOrEqual(0);
  expect(strip.x + strip.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(today(page).getByRole("heading", { name: "Today" })).toBeInViewport();
  const box = (await reminder(page).locator(".toast").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
