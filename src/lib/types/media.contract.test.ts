import { describe, expect, it } from "vitest";
import fixture from "./contract.fixture.json";
import type { GenreOption, MediaDetail, MediaItem, PaginatedResult } from "./media";

const ITEM_KEYS = {
  id: 0,
  provider: 0,
  media_key: 0,
  title: 0,
  overview: 0,
  poster_path: 0,
  backdrop_path: 0,
  vote_average: 0,
  vote_count: 0,
  release_date: 0,
  first_air_date: 0,
  genre_ids: 0,
  media_type: 0,
  author: 0,
  episodes: 0,
  chapters: 0,
} satisfies Record<keyof MediaItem, 0>;

const DETAIL_KEYS = {
  id: 0,
  provider: 0,
  media_key: 0,
  media_type: 0,
  title: 0,
  tagline: 0,
  overview: 0,
  poster_path: 0,
  backdrop_path: 0,
  vote_average: 0,
  vote_count: 0,
  release_date: 0,
  runtime: 0,
  genres: 0,
  cast: 0,
  videos: 0,
  author: 0,
  episodes: 0,
  chapters: 0,
  volumes: 0,
  status: 0,
  studios: 0,
  subjects: 0,
  developer: 0,
  publisher: 0,
  platforms: 0,
  screenshots: 0,
} satisfies Record<keyof MediaDetail, 0>;

const PAGE_KEYS = {
  results: 0,
  page: 0,
  total_pages: 0,
  total_results: 0,
} satisfies Record<keyof PaginatedResult<MediaItem>, 0>;

const GENRE_KEYS = { id: 0, name: 0 } satisfies Record<keyof GenreOption, 0>;

const keys = (o: object) => Object.keys(o).sort();

// The fixture is written by the Rust test `contract_fixture_matches_the_rust_types`.
describe("IPC contract (Rust DTOs ↔ media.ts)", () => {
  it("MediaItem has exactly the Rust fields", () => {
    expect(keys(fixture.item)).toEqual(keys(ITEM_KEYS));
  });

  it("MediaDetail has exactly the Rust fields", () => {
    expect(keys(fixture.detail)).toEqual(keys(DETAIL_KEYS));
    expect(keys(fixture.detail.cast[0])).toEqual(["character", "id", "name", "profile_path"]);
    expect(keys(fixture.detail.videos[0])).toEqual(["key", "name", "site", "type"]);
  });

  it("Page and GenreOption have exactly the Rust fields", () => {
    expect(keys(fixture.page)).toEqual(keys(PAGE_KEYS));
    expect(keys(fixture.genre)).toEqual(keys(GENRE_KEYS));
  });
});
