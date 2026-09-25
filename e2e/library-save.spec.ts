import { expect, test } from "@playwright/test";

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
  },
  user: { status: "planning", progress: 0, rating: null, review: null },
  created_at: "2026-09-25T12:00:00Z",
  updated_at: "2026-09-25T12:00:00Z",
};

async function mockIpc(page: import("@playwright/test").Page, addFails: boolean) {
  await page.addInitScript(
    ({ detail, saved, fails }) => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === "catalog_detail") return structuredClone(detail);
          if (cmd === "library_load") return [];
          if (cmd === "library_add") {
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

  await expect(page.getByText(/disk full/i)).toBeVisible();
  await expect(addButton).toBeVisible();
  await expect(page.getByLabel(/status/i)).toHaveCount(0);
});

test("a successful save shows the status control", async ({ page }) => {
  await mockIpc(page, false);
  await page.goto("/media/movie/1");

  await page.getByRole("button", { name: /add to library/i }).click();

  await expect(page.getByLabel(/status/i)).toHaveValue("planning");
  await expect(page.getByRole("button", { name: /add to library/i })).toHaveCount(0);
});
