import { expect, test } from "@playwright/test";
import { eventsAtLevel, ipcCalls, item, mockLibrary } from "./fixtures/library";

// The optimistic save must undo itself visibly; this drives it with a rejecting backend.
const DETAIL = {
  id: 1,
  provider: "tmdb",
  media_key: "tmdb:movie:1",
  media_type: "movie",
  title: "Test movie 1",
  tagline: "Tagline",
  overview: "Test synopsis.",
  poster_path: null,
  backdrop_path: null,
  vote_average: 7.4,
  vote_count: 1234,
  release_date: "2024-05-01",
  runtime: 128,
  genres: [{ id: 28, name: "Action" }],
  cast: [],
  videos: [],
  studios: [],
};

const SAVED = {
  key: "tmdb:movie:1",
  snapshot: {
    media_key: "tmdb:movie:1",
    provider: "tmdb",
    media_type: "movie",
    title: "Test movie 1",
    poster_path: null,
    year: "2024",
    poster_file: null,
  },
  user: {
    status: "planning",
    progress: 0,
    rating: null,
    review: null,
    length: {
      runtime_minutes: null,
      episodes: null,
      episode_minutes: null,
      chapters: null,
      chapter_minutes: null,
      pages: null,
      hours: null,
    },
  },
  created_at: "2026-09-25T12:00:00Z",
  updated_at: "2026-09-25T12:00:00Z",
};

async function mockIpc(page: import("@playwright/test").Page, addFails: boolean) {
  await page.addInitScript(
    ({ detail, saved, fails }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__addCalls = 0;
      w.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === "catalog_detail") return structuredClone(detail);
          if (cmd === "library_load") return [];
          if (cmd === "startup_status") return null;
          // An established user: an empty library alone must not trigger the welcome.
          if (cmd === "prefs_load")
            return {
              motion: true,
              seen_level: 0,
              reading_pages_per_hour: null,
              welcomed: true,
              welcome_beat: 0,
              taste_families: [],
              taste_genres: [],
            };
          if (cmd === "library_add") {
            w.__addCalls = (w.__addCalls as number) + 1;
            if (fails) throw "disk full";
            return structuredClone(saved);
          }
          if (cmd === "library_update") return structuredClone(saved);
          if (cmd === "library_remove") return true;
          return { page: 1, total_pages: 1, total_results: 0, results: [] };
        },
        transformCallback: () => 0,
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      };
    },
    { detail: DETAIL, saved: SAVED, fails: addFails },
  );
}

test("a rejected save rolls back and shows why", async ({ page }) => {
  await mockIpc(page, true);
  await page.goto("/media/movie/1");

  const addButton = page.getByRole("button", { name: /add to library/i });
  await expect(addButton).toBeVisible();
  await addButton.click();
  await page.getByRole("button", { name: /skip/i }).click();

  await expect(page.getByText(/disk full/i)).toBeVisible();
  await expect(addButton).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "Item actions" })).toHaveCount(0);
});

test("a successful save shows the status control", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/media/movie/1");

  await page.getByRole("button", { name: /add to library/i }).click();
  await page.getByRole("button", { name: /skip/i }).click();

  await expect(page.getByText("Status: Planning")).toBeVisible();
  await expect(page.getByRole("button", { name: /add to library/i })).toHaveCount(0);
});

test("adding opens the sheet first and saves nothing until the user answers", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/media/movie/1");

  await page.getByRole("button", { name: /add to library/i }).click();

  const sheet = page.getByRole("dialog", { name: /add to library/i });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel(/runtime/i)).toHaveValue("128");
  expect(await page.evaluate(() => (window as unknown as { __addCalls: number }).__addCalls)).toBe(
    0,
  );

  await sheet.getByRole("button", { name: /^save/i }).click();
  await expect(page.getByText("Status: Planning")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __addCalls: number }).__addCalls)).toBe(
    1,
  );
});

test("the add sheet fits the narrowest window", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: /add to library/i }).click();

  const sheet = page.getByRole("dialog", { name: /add to library/i });
  const box = await sheet.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
});

test("the add sheet is modal and the backdrop closes it", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: /add to library/i }).click();

  const sheet = page.getByRole("dialog", { name: /add to library/i });
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((node) => node.matches(":modal"))).toBe(true);
  await page.mouse.click(4, 4);
  await expect(sheet).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __addCalls: number }).__addCalls)).toBe(
    0,
  );
});

test("a saved item without length can add it later", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: /add to library/i }).click();
  await page.getByRole("button", { name: /skip/i }).click();
  await expect(page.getByText("Status: Planning")).toBeVisible();

  await page.getByRole("button", { name: /add length/i }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Test movie 1" });
  await expect(sheet).toBeVisible();
  // The sheet takes focus, not the number field, so a phone keyboard does not cover Save.
  await expect(sheet).toBeFocused();
  await expect(sheet.getByLabel(/runtime/i)).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("a saved item's known length can be edited from its page", async ({ page }) => {
  await mockLibrary(page, [item(4, "tv", "Arcane", { episodes: 9, episode_minutes: 40 }, null)]);
  await page.goto("/media/tv/4");
  await page.getByRole("button", { name: "Edit length" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Arcane" });
  await expect(sheet.getByRole("button", { name: /skip/i })).toHaveCount(0);
  await expect(sheet.getByLabel("Minutes per episode")).toHaveValue("40");
  await sheet.getByLabel("Minutes per episode").fill("30");
  await sheet.getByRole("button", { name: /^save/i }).click();
  await expect(sheet).toHaveCount(0);
  const saved = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(saved.at(-1)?.args).toMatchObject({
    key: "tmdb:tv:4",
    patch: { length: { episodes: 9, episode_minutes: 30 } },
  });
  await expect(page.getByRole("button", { name: "Edit length" })).toBeVisible();
});

test("the stars and their word fit on screen", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: /add to library/i }).click();
  await page.getByRole("button", { name: /skip/i }).click();

  await expect(page.getByRole("slider", { name: "Rating" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("Not rated")).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test("on a phone the add sheet sits at the bottom and Back closes it, not the page", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width > 768, "the bottom sheet is the phone layout");
  await mockIpc(page, false);
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: /add to library/i }).click();

  const sheet = page.getByRole("dialog", { name: /add to library/i });
  await expect(sheet).toBeVisible();
  await sheet.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
  const bottom = async () => {
    const box = (await sheet.boundingBox())!;
    return Math.round(box.y + box.height);
  };
  await expect.poll(bottom).toBe(page.viewportSize()!.height);
  const fullWidth = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.cssText = "position:fixed;inset:0 0 auto 0;height:1px";
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  });
  expect(Math.round((await sheet.boundingBox())!.width)).toBe(Math.round(fullWidth));
  await expect(sheet.getByRole("button", { name: /^save/i })).toBeInViewport();

  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/media\/movie\/1$/);
});

test("closing the sheet another way leaves Back for the page", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/");
  await page.goto("/media/movie/1");
  await page.getByRole("button", { name: /add to library/i }).click();
  const sheet = page.getByRole("dialog", { name: /add to library/i });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/media\/movie\/1$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("a show the catalog can't time asks for its episode length, and says why", async ({
  page,
}) => {
  const st = item(66, "tv", "Stranger Things", { episodes: 42 }, null);
  await mockLibrary(page, [st], { details: { "tmdb:tv:66": { episodes: 42, runtime: null } } });
  await page.goto("/media/tv/66");
  const note = page.getByRole("note");
  await expect(note).toContainText("TMDB doesn't list the minutes per episode for Stranger Things");
  await note.getByRole("button", { name: "Add length" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Stranger Things" });
  await sheet.getByLabel("Minutes per episode").fill("50");
  await sheet.getByRole("button", { name: /^save/i }).click();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit length" })).toBeVisible();
});

test("a show the catalog can time shows no warning", async ({ page }) => {
  const ghoul = item(67, "tv", "Tokyo Ghoul", { episodes: 48 }, null);
  await mockLibrary(page, [ghoul], { details: { "tmdb:tv:67": { episodes: 48, runtime: 24 } } });
  await page.goto("/media/tv/67");
  await expect(page.getByText("Length unknown.")).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
});

const STRANGER = item(66, "tv", "Stranger Things", { episodes: 42 }, null);
const NO_RUNTIME = { "tmdb:tv:66": { episodes: 42, runtime: null } };

test("the length warning takes the equipped accent's colours", async ({ page }) => {
  await mockLibrary(page, [STRANGER], {
    details: NO_RUNTIME,
    events: eventsAtLevel(3),
    seenLevel: 3,
    prefs: { accent: "ember" },
  });
  await page.goto("/media/tv/66");
  const note = page.getByRole("note");
  await expect(note).toBeVisible();
  const colours = await note.evaluate((n) => {
    const button = getComputedStyle(n.querySelector("button") as HTMLElement);
    return {
      bar: getComputedStyle(n).borderInlineStartColor,
      button: button.backgroundColor,
      text: button.color,
    };
  });
  // Ember is a light orange, so its own dark text must reach the button.
  expect(colours).toEqual({
    bar: "rgb(163, 80, 12)",
    button: "rgb(199, 102, 18)",
    text: "rgb(28, 18, 8)",
  });
});

for (const theme of ["dark", "light"]) {
  test(`Ember's dark text reaches filled buttons in the ${theme} theme too`, async ({ page }) => {
    await mockLibrary(page, [STRANGER], {
      details: NO_RUNTIME,
      events: eventsAtLevel(3),
      seenLevel: 3,
      prefs: { accent: "ember", theme },
    });
    await page.goto("/media/tv/66");
    const button = page.getByRole("note").getByRole("button", { name: "Add length" });
    await expect(button).toHaveCSS("color", "rgb(28, 18, 8)");
  });
}

test("with the default accent the warning follows the default accent token", async ({ page }) => {
  await mockLibrary(page, [STRANGER], { details: NO_RUNTIME });
  await page.goto("/media/tv/66");
  const note = page.getByRole("note");
  await expect(note).toBeVisible();
  const { bar, token } = await note.evaluate((n) => ({
    bar: getComputedStyle(n).borderInlineStartColor,
    token: getComputedStyle(document.documentElement).getPropertyValue("--clr-accent-rgb").trim(),
  }));
  expect(bar).toBe(`rgb(${token.split(/\s+/).join(", ")})`);
  expect(bar).not.toBe("rgb(163, 80, 12)");
  const text = await note.getByRole("button").evaluate((b) => getComputedStyle(b).color);
  expect(text).toMatch(/^rgb\((255, 255, 255|245, 245, 241)\)$/);
});

test("a typical episode length fills the field in one tap, without the keyboard", async ({
  page,
}) => {
  await mockLibrary(page, [STRANGER], { details: NO_RUNTIME });
  await page.goto("/media/tv/66");
  await page.getByRole("note").getByRole("button", { name: "Add length" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Stranger Things" });
  const lengths = sheet.getByRole("group", { name: "Common episode lengths" });
  await lengths.getByRole("button", { name: "45 min" }).click();
  await expect(sheet.getByLabel("Minutes per episode")).toHaveValue("45");
  await expect(sheet.getByLabel("Minutes per episode")).not.toBeFocused();
  await expect(lengths.getByRole("button", { name: "45 min" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await sheet.getByRole("button", { name: /^save/i }).click();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit length" })).toBeVisible();
});
