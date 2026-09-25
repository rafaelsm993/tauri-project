import { expect, test, type Page } from "@playwright/test";

const TYPES = ["movie", "tv", "anime", "manga", "book", "game"] as const;

function saved(i: number) {
  const type = TYPES[i % TYPES.length];
  const key = `tmdb:${type}:${i}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title: `Saved title number ${i}`,
      poster_path: null,
      year: "2020",
    },
    user: {
      status: i % 2 ? "in_progress" : "planning",
      progress: i,
      rating: null,
      review: null,
      length: {
        runtime_minutes: null,
        episodes: 20,
        episode_minutes: null,
        chapters: null,
        chapter_minutes: null,
        pages: null,
        hours: null,
      },
    },
    created_at: "2026-09-25T00:00:00Z",
    updated_at: `2026-09-25T00:00:0${i}Z`,
  };
}

async function mockLibrary(page: Page) {
  const entries = Array.from({ length: 8 }, (_, i) => saved(i + 1));
  await page.addInitScript((list) => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        if (cmd === "library_load") return structuredClone(list);
        return { page: 1, total_pages: 1, total_results: 0, results: [], genres: [] };
      },
      transformCallback: () => 0,
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    };
  }, entries);
}

test("the library lists saved items and filters them", async ({ page }) => {
  await mockLibrary(page);
  await page.goto("/library");
  const cards = page.getByRole("list").getByRole("link");
  await expect(cards).toHaveCount(8);
  await page
    .getByRole("group", { name: "Status" })
    .getByRole("button", { name: /^in progress/i })
    .click();
  await expect(cards).toHaveCount(4);
});

test("the library has no horizontal overflow", async ({ page }) => {
  await mockLibrary(page);
  await page.goto("/library");
  await expect(page.getByRole("list").getByRole("link")).toHaveCount(8);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a card opens the detail page", async ({ page }) => {
  await mockLibrary(page);
  await page.goto("/library");
  await page.getByRole("link", { name: /saved title number 1\b/i }).click();
  await expect(page).toHaveURL(/\/media\/tv\/1$/);
});
