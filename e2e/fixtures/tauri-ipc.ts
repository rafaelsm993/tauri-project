import { test as base } from "@playwright/test";

// Deterministic IPC fixtures; unknown commands get an empty page so the UI shows its empty state.
const MOVIE = (id: number) => ({
  id,
  provider: "tmdb",
  media_key: `tmdb:movie:${id}`,
  title: `Test movie ${id} with a very long title to break the layout`,
  overview: "Test synopsis. ".repeat(12),
  poster_path: null,
  backdrop_path: null,
  vote_average: 7.4,
  vote_count: 1234,
  release_date: "2024-05-01",
  genre_ids: [28],
  media_type: "movie",
});

const FIXTURES: Record<string, unknown> = {
  // Real TMDB count (19): the home page renders one lazy carousel per genre.
  catalog_genres: [
    [28, "Action"],
    [12, "Adventure"],
    [16, "Animation"],
    [35, "Comedy"],
    [80, "Crime"],
    [99, "Documentary"],
    [18, "Drama"],
    [10751, "Family"],
    [14, "Fantasy"],
    [36, "History"],
    [27, "Horror"],
    [10402, "Music"],
    [9648, "Mystery"],
    [10749, "Romance"],
    [878, "Science Fiction"],
    [10770, "TV Movie"],
    [53, "Thriller"],
    [10752, "War"],
    [37, "Western"],
  ].map(([id, name]) => ({ id, name })),
  catalog_page: {
    page: 1,
    total_pages: 1,
    total_results: 12,
    results: Array.from({ length: 12 }, (_, i) => MOVIE(i + 1)),
  },
  catalog_detail: {
    ...MOVIE(1),
    tagline: "Tagline",
    runtime: 128,
    genres: [{ id: 28, name: "Action" }],
    cast: [],
    videos: [],
    studios: [],
  },
  library_load: [],
};

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((fixtures) => {
      const empty = { page: 1, total_pages: 1, total_results: 0, results: [] };
      const calls: string[] = [];
      Object.assign(window, { __ipcCalls: calls });
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          calls.push(cmd);
          return structuredClone(fixtures[cmd] ?? empty);
        },
        transformCallback: () => 0,
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      };
    }, FIXTURES);
    await use(page);
  },
});
export { expect } from "@playwright/test";
