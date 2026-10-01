import { expect, test, type Page } from "@playwright/test";

const LENGTH = {
  runtime_minutes: null,
  episodes: null,
  episode_minutes: null,
  chapters: null,
  chapter_minutes: null,
  pages: null,
  hours: null,
};

function item(id: number, type: string, title: string, length: object, plan: object | null) {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title,
      poster_path: null,
      year: "2024",
      poster_file: null,
    },
    user: {
      status: "in_progress",
      progress: 0,
      rating: null,
      review: null,
      length: { ...LENGTH, ...length },
      plan,
    },
    created_at: "2026-09-25T00:00:00Z",
    updated_at: "2026-09-25T00:00:00Z",
  };
}

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

// A stateful fake: library_update merges its patch, so a saved plan shows up on the page.
async function mockPlanner(page: Page, entries: object[] = LIBRARY) {
  await page.clock.setFixedTime(new Date("2026-10-01T10:00:00"));
  await page.addInitScript((list) => {
    const library = structuredClone(list) as { key: string; user: Record<string, unknown> }[];
    const prefs = { background_animation: true, seen_level: 0, reading_pages_per_hour: null };
    const calls: { cmd: string; args: unknown }[] = [];
    Object.assign(window, { __ipcCalls: calls });
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: { key?: string; patch?: Record<string, unknown> }) => {
        calls.push({ cmd, args });
        if (cmd === "library_load") return structuredClone(library);
        if (cmd === "library_update") {
          const entry = library.find((e) => e.key === args?.key)!;
          Object.assign(entry.user, args?.patch);
          return structuredClone(entry);
        }
        if (cmd === "library_events") return [];
        if (cmd === "startup_status") return null;
        if (cmd === "library_poster_dir") return "/nonexistent/posters";
        if (cmd === "prefs_load") return { ...prefs };
        if (cmd === "prefs_update") return Object.assign(prefs, args?.patch);
        return { page: 1, total_pages: 1, total_results: 0, results: [], genres: [] };
      },
      transformCallback: () => 0,
      convertFileSrc: (path: string) => `/missing-asset/${encodeURIComponent(path)}`,
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    };
  }, entries);
}

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
  await dialog.getByRole("group", { name: "Days" }).getByRole("button", { name: "Tue" }).click();
  await dialog.getByRole("button", { name: "45 min" }).click();
  await expect(dialog).toContainText(/finishes/i);
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit plan for Arcane" })).toBeVisible();
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("link", { name: "Planner" }).click();
  await expect(page.getByRole("list", { name: "Plans" })).toContainText("Arcane");
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

test("the plan sheet never talks about being behind", async ({ page }) => {
  await mockPlanner(page);
  await page.goto("/planner");
  await page.getByRole("button", { name: /^Edit Frieren/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Fri" }).click();
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
  const chips = page.getByRole("dialog").getByRole("group").getByRole("button");
  for (const h of await chips.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().height),
  ))
    expect(h).toBeGreaterThanOrEqual(44);
  expect(await noOverflow(page)).toBeLessThanOrEqual(0);
});
