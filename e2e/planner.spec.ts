import { openSettingsSection } from "./fixtures/settings";
import { expect, test, type Page } from "@playwright/test";
import { eventsAtLevel, ipcCalls, item, mockLibrary, type LibraryFake } from "./fixtures/library";

const MWF = { days: [0, 2, 4], max_session_minutes: 60, since: "2026-09-28" };
const LIBRARY = [
  item(
    1,
    "anime",
    "Frieren: Beyond Journey's End, a title long enough to wrap",
    { episodes: 28, episode_minutes: 24 },
    MWF,
  ),
  item(
    2,
    "game",
    "Hades",
    { hours: 20 },
    { days: [5, 6], max_session_minutes: 120, since: "2026-09-28" },
  ),
  item(3, "manga", "Berserk", { chapters: 300 }, MWF),
  item(4, "tv", "Arcane", { episodes: 9, episode_minutes: 40 }, null),
];

const mockPlanner = (page: Page, entries: object[] = LIBRARY, fake: LibraryFake = {}) =>
  mockLibrary(page, entries, fake);

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("the planner lays out this week and lists every plan", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: "Week of Mon, Sep 28" })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Thu, Oct 1" })).toHaveAttribute(
    "aria-current",
    "date",
  );
  const fri = page.getByRole("listitem", { name: "Fri, Oct 2" });
  await expect(fri.getByLabel(/^Frieren.*, \d+ (h|min)/)).toBeVisible();
  const sat = page.getByRole("listitem", { name: "Sat, Oct 3" });
  await expect(sat.getByLabel("Hades, 2 h")).toBeVisible();
  await expect(page.getByRole("list", { name: "Plans" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("list", { name: "Needs a length" })).toContainText("Berserk");
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});

test("every day of the week is reachable (fits or scrolls sideways)", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/planner");
  const week = page.getByRole("list", { name: "Week" });
  await expect(week.getByRole("listitem", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/ })).toHaveCount(
    7,
  );
  const ok = await week.evaluate((el) => {
    const s = getComputedStyle(el);
    return el.scrollWidth <= el.clientWidth || ["auto", "scroll"].includes(s.overflowX);
  });
  expect(ok, "the week is clipped and can't be scrolled to").toBe(true);
});

test("on a narrow screen the week opens scrolled to today", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/planner");
  const today = page.getByRole("listitem", { name: "Thu, Oct 1" });
  await expect(today).toBeInViewport({ ratio: 0.9 });
});

test("week navigation moves a week and comes back", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/planner");
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByRole("heading", { name: "Week of Mon, Oct 5" })).toBeVisible();
  await page.getByRole("button", { name: "This week" }).click();
  await expect(page.getByRole("heading", { name: "Week of Mon, Sep 28" })).toBeVisible();
});

test("planning from the library card shows up in the planner", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Arcane" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Arcane" });
  await dialog
    .getByRole("group", { name: "Days" })
    .getByRole("button", { name: "Tuesday" })
    .click();
  await dialog.getByRole("button", { name: "More episodes" }).click();
  await expect(dialog).toContainText(/finishes/i);
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit plan for Arcane" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Planner" })
    .click();
  await expect(page.getByRole("list", { name: "Plans" })).toContainText("Arcane");
});

test("a new plan for an episode-length item starts at one full episode", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Arcane" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Arcane" });
  await expect(dialog.getByRole("button", { name: "Full episode 40 min" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog
    .getByRole("group", { name: "Days" })
    .getByRole("button", { name: "Tuesday" })
    .click();
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toBeHidden();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ patch: { plan: { max_session_minutes: 40 } } });
});

test("a plan that needs a length asks for it and then joins the week", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/planner");
  await page.getByRole("button", { name: "Plan Berserk" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Berserk" });
  await dialog.getByLabel(/minutes per chapter/i).fill("6");
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Needs a length" })).toBeHidden();
  await expect(page.getByRole("list", { name: "Plans" })).toContainText("Berserk");
});

test("minutes per chapter set in Settings prefill a manga's plan", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/settings");
  await openSettingsSection(page, "Preferences");
  const chapter = page.getByLabel("Minutes per chapter (manga)");
  await chapter.fill("6");
  await chapter.blur();
  await expect
    .poll(async () => (await ipcCalls(page)).filter((c) => c.cmd === "prefs_update").at(-1)?.args)
    .toMatchObject({ patch: { manga_chapter_minutes: 6 } });
  // In-app navigation: a reload would restart the fake with its default prefs.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Planner" })
    .click();
  await page.getByRole("button", { name: "Plan Berserk" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Berserk" });
  await expect(dialog.getByLabel(/minutes per chapter/i)).toHaveValue("6");
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Plans" })).toContainText("Berserk");
});

test("a book's reading pace can be changed in its plan", async ({ page }) => {
  await mockPlanner(page, [...LIBRARY, item(5, "book", "Dune", { pages: 300 }, null)], {
    prefs: { reading_pages_per_hour: 30 },
  });
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Dune" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Dune" });
  const pace = dialog.getByLabel("Pages per hour");
  await expect(pace).toHaveValue("30");
  await pace.fill("60");
  await dialog.getByRole("group", { name: "Days" }).getByRole("button", { name: "Monday" }).click();
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toBeHidden();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "prefs_update");
  expect(saved.at(-1)?.args).toMatchObject({ patch: { reading_pages_per_hour: 60 } });
});

test("the plan sheet never talks about being behind", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/planner");
  await page.getByRole("button", { name: /^Edit Frieren/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Friday" }).click();
  await expect(dialog).toContainText(/than before|same finish date/i);
  await expect(dialog).not.toContainText(/behind|overdue|missed|\blate\b/i);
});

test("the empty planner points to the library", async ({ page }) => {
  await mockPlanner(page, []);
  await page.goto("/planner");
  await expect(page.getByText(/nothing planned yet/i)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "library" })).toHaveAttribute(
    "href",
    "/library",
  );
});

test("planner and plan sheet controls are touch-sized", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mouse viewports may use compact targets");
  await mockPlanner(page);
  await page.goto("/planner");
  const targets = [
    page.getByRole("button", { name: "Next week" }),
    page.getByRole("button", { name: "Previous week" }),
    page.getByRole("button", { name: /^Edit Frieren/ }),
  ];
  for (const el of targets) {
    const box = await el.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await targets[2].click();
  // Mid slide-up the translated box measures 43.9999px; size it once the sheet has landed.
  await page
    .getByRole("dialog")
    .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  const chips = page.getByRole("dialog").getByRole("group").getByRole("button");
  for (const h of await chips.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().height),
  ))
    expect(h).toBeGreaterThanOrEqual(44);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});

test("a new plan takes the episode length the catalog lists", async ({ page }) => {
  const ghoul = item(7, "tv", "Tokyo Ghoul", { episodes: 48 }, null);
  await mockLibrary(page, [ghoul], { details: { "tmdb:tv:7": { episodes: 48, runtime: 24 } } });
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Tokyo Ghoul" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Tokyo Ghoul" });
  await expect(dialog.getByLabel("Minutes per episode")).toHaveValue("24");
  await expect(dialog.getByText(/filled in from tmdb/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Full episode 24 min" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog
    .getByRole("group", { name: "Days" })
    .getByRole("button", { name: "Tuesday" })
    .click();
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toHaveCount(0);
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved[0]?.args).toMatchObject({
    patch: { length: { episodes: 48, episode_minutes: 24 } },
  });
  expect(saved.at(-1)?.args).toMatchObject({ patch: { plan: { max_session_minutes: 24 } } });
});

test("planning a show the catalog can't time warns inside the plan", async ({ page }) => {
  const st = item(66, "tv", "Stranger Things", { episodes: 42 }, null);
  await mockLibrary(page, [st], { details: { "tmdb:tv:66": { episodes: 42, runtime: null } } });
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Stranger Things" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Stranger Things" });
  await expect(dialog.getByRole("note")).toContainText(
    "TMDB doesn't list the minutes per episode for Stranger Things",
  );
  await expect(dialog.getByLabel("Minutes per episode")).toHaveValue("");
});

test("the plan marks its missing length as required, in the equipped accent", async ({ page }) => {
  const st = item(66, "tv", "Stranger Things", { episodes: 42 }, null);
  await mockLibrary(page, [st], {
    details: { "tmdb:tv:66": { episodes: 42, runtime: null } },
    events: eventsAtLevel(3),
    seenLevel: 3,
    prefs: { accent: "ember" },
  });
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Stranger Things" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Stranger Things" });
  const field = dialog.getByLabel("Minutes per episode");
  await expect(field).toHaveAttribute("aria-required", "true");
  await expect(dialog.getByText("Required")).toBeVisible();
  await expect(field).toHaveCSS("border-top-color", "rgb(163, 80, 12)");
  await field.fill("50");
  await expect(field).not.toHaveCSS("border-top-color", "rgb(163, 80, 12)");
});

test("an anime plans whole episodes around Full episode, with a quiet Custom", async ({ page }) => {
  const aot = item(16498, "anime", "Attack on Titan", { episodes: 25, episode_minutes: 24 }, null);
  await mockLibrary(page, [aot], {
    events: eventsAtLevel(3),
    seenLevel: 3,
    prefs: { accent: "ember" },
  });
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Attack on Titan" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Attack on Titan" });
  const picker = dialog.getByRole("group", { name: "Up to, per session" });
  const center = picker.getByRole("button", { name: /^(Full episode|\d+ episodes)/ });
  await expect(center).toHaveAccessibleName("Full episode 24 min");
  await expect(picker.getByRole("button", { name: "Fewer episodes" })).toBeDisabled();
  await picker.getByRole("button", { name: "More episodes" }).click();
  await picker.getByRole("button", { name: "More episodes" }).click();
  await expect(center).toHaveAccessibleName("3 episodes 1 h 12 min");
  await expect(center).toHaveCSS("background-color", "rgb(199, 102, 18)");
  await expect(center).toHaveCSS("color", "rgb(28, 18, 8)");
  // Arrows and centre share one row; Custom sits under the right arrow.
  const box = async (name: string | RegExp) =>
    (await picker.getByRole("button", { name }).boundingBox())!;
  const fewerBox = await box("Fewer episodes");
  const moreBox = await box("More episodes");
  const customBox = await box("Custom");
  expect(Math.round(fewerBox.y)).toBe(Math.round(moreBox.y));
  expect(customBox.y).toBeGreaterThan(moreBox.y + moreBox.height - 1);
  expect(Math.round(customBox.x + customBox.width)).toBe(Math.round(moreBox.x + moreBox.width));
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  await picker.getByRole("button", { name: "Custom" }).click();
  // Custom types straight into the centre.
  await expect(picker.getByLabel("Minutes per session")).toBeFocused();
  await dialog.getByLabel("Minutes per session").fill("100");
  await dialog
    .getByRole("group", { name: "Days" })
    .getByRole("button", { name: "Saturday" })
    .click();
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toHaveCount(0);
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ patch: { plan: { max_session_minutes: 100 } } });
});

test("a book plans by the hour and shows the pages", async ({ page }) => {
  const dune = item(3, "book", "Dune", { pages: 600 }, null);
  await mockLibrary(page, [dune]);
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Dune" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Dune" });
  const picker = dialog.getByRole("group", { name: "Up to, per session" });
  await expect(picker).toContainText("1 h");
  await expect(picker).toContainText("≈ 30 pages");
  await picker.getByRole("button", { name: "30 min more" }).click();
  await expect(picker).toContainText("≈ 45 pages");
  await dialog.getByRole("group", { name: "Days" }).getByRole("button", { name: "Monday" }).click();
  await dialog.getByRole("button", { name: "Save plan" }).click();
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({ patch: { plan: { max_session_minutes: 90 } } });
});

test("a manga plans whole chapters", async ({ page }) => {
  const csm = item(8, "manga", "Chainsaw Man", { chapters: 232, chapter_minutes: 20 }, null);
  await mockLibrary(page, [csm]);
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Chainsaw Man" }).click();
  const picker = page.getByRole("dialog").getByRole("group", { name: "Up to, per session" });
  await expect(picker.getByRole("button", { name: "Full chapter 20 min" })).toBeVisible();
  await picker.getByRole("button", { name: "More chapters" }).click();
  await expect(picker.getByRole("button", { name: "2 chapters 40 min" })).toBeVisible();
});
