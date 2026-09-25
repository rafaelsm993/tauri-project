import { describe, expect, it } from "vitest";
import { toMediaItem } from "./media";
import type { MediaDetail } from "./media";

const DETAIL = {
  id: 7,
  provider: "tmdb",
  media_key: "tmdb:tv:7",
  media_type: "tv",
  title: "Arcane",
  tagline: "",
  overview: "Two sisters.",
  poster_path: "/p.jpg",
  backdrop_path: "/b.jpg",
  vote_average: 8.7,
  vote_count: 1200,
  release_date: "2021-11-06",
  episodes: 18,
  chapters: null,
  genres: [],
  cast: [],
  videos: [],
} as unknown as MediaDetail;

describe("toMediaItem", () => {
  it("keeps the identity fields a library entry needs", () => {
    const item = toMediaItem(DETAIL);
    expect(item.media_key).toBe("tmdb:tv:7");
    expect(item.media_type).toBe("tv");
    expect(item.provider).toBe("tmdb");
    expect(item.id).toBe(7);
    expect(item.title).toBe("Arcane");
    expect(item.poster_path).toBe("/p.jpg");
  });

  it("carries the fields a card shows", () => {
    const item = toMediaItem(DETAIL);
    expect(item.overview).toBe("Two sisters.");
    expect(item.backdrop_path).toBe("/b.jpg");
    expect(item.vote_average).toBe(8.7);
    expect(item.vote_count).toBe(1200);
    expect(item.release_date).toBe("2021-11-06");
  });

  it("defaults a missing poster and counts instead of leaving them undefined", () => {
    const bare = {
      id: "b1",
      provider: "itunes",
      media_key: "itunes:book:b1",
      media_type: "book",
      title: "Dune",
    } as unknown as MediaDetail;
    const item = toMediaItem(bare);
    expect(item.poster_path).toBeNull();
    expect(item.backdrop_path).toBeNull();
    expect(item.overview).toBe("");
    expect(item.vote_average).toBe(0);
    expect(item.vote_count).toBe(0);
  });
});
