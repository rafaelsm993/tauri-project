import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";

// 120 XP (level 1); finishing movie 1 adds 50 and crosses level 2 (141).
const LOG = [
  { id: "e1", media_key: "tmdb:movie:11", day: "2026-09-19", rating: 9 },
  { id: "e2", media_key: "tmdb:movie:12", day: "2026-09-20", rating: null },
].map(({ id, media_key, day, rating }) => ({
  id,
  kind: "library_add",
  media_key,
  at_utc: `${day}T12:00:00.000Z`,
  local_date: day,
  payload: rating ? { status: "completed", rating } : { status: "completed" },
}));

const ENTRY = {
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
    status: "watching",
    progress: 0,
    rating: null,
    review: null,
    length: {
      runtime_minutes: 100,
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

// The movie is already saved, and level 1 was already seen: the next level is news.
async function onMoviePage(page: Page) {
  await page.addInitScript(
    ({ entry, log }) => {
      type Invoke = (cmd: string, args?: { patch?: object }) => Promise<unknown>;
      const w = window as unknown as { __TAURI_INTERNALS__: { invoke: Invoke } };
      const base = w.__TAURI_INTERNALS__.invoke;
      const seen = { level: 1 };
      const prefs = () => ({ motion: true, seen_level: seen.level });
      w.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
        if (cmd === "library_load") return [structuredClone(entry)];
        if (cmd === "library_events") return structuredClone(log);
        if (cmd === "library_update") {
          return { ...structuredClone(entry), user: { ...entry.user, ...args?.patch } };
        }
        if (cmd === "prefs_load") return prefs();
        if (cmd === "prefs_update") {
          const level = (args?.patch as { seen_level?: number }).seen_level;
          if (level !== undefined) seen.level = level;
          return prefs();
        }
        return base(cmd, args);
      };
    },
    { entry: ENTRY, log: LOG },
  );
  await page.goto("/media/movie/1");
}

const completed = (page: Page) =>
  page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Completed" });

// The level-up live region; empty when no toast is showing.
const toastRegion = (page: Page) => page.getByRole("status", { name: "Level up" });

test.describe("level-up moment", () => {
  test("finishing a movie that crosses a level shows the toast once", async ({ page }) => {
    await onMoviePage(page);
    await completed(page).click();
    const toast = page.getByRole("status").filter({ hasText: "Level 2" });
    await expect(toast).toBeVisible();

    const box = (await toast.boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);

    await toast.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);

    await page
      .getByRole("group", { name: "Status" })
      .getByRole("button", { name: "In progress" })
      .click();
    await completed(page).click();
    await expect(toastRegion(page)).toBeEmpty();

    await page.reload();
    await expect(completed(page)).toBeVisible();
    await expect(toastRegion(page)).toBeEmpty();
  });

  test("the toast stays clear of the offline pill", async ({ page }) => {
    await onMoviePage(page);
    await expect(completed(page)).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    const pill = page.getByRole("status").filter({ hasText: "Offline" });
    await expect(pill).toBeVisible();
    await completed(page).click();
    const toast = page.getByRole("status").filter({ hasText: "Level 2" });
    await expect(toast).toBeVisible();
    const a = (await toast.getByText("Level 2").locator("xpath=../..").boundingBox())!;
    const b = (await pill.locator("p").boundingBox())!;
    expect(a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  });

  test("the toast's Close is touch-sized on coarse pointers", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    await onMoviePage(page);
    await completed(page).click();
    const close = page.getByRole("button", { name: "Close" });
    const box = (await close.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test("the navigation shows the new level right away", async ({ page }) => {
    await onMoviePage(page);
    await completed(page).click();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(
      page
        .getByRole("link", { name: "Level 2 · Newcomer" })
        .or(nav.getByRole("link", { name: "Profile · Level 2" }))
        .first(),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "Profile · Level 2" })).toHaveCount(1);
  });
});
