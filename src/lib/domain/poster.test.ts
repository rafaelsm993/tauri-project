import { describe, expect, it } from "vitest";
import { posterSources } from "./poster";

const toSrc = (path: string) => `asset://${path}`;
const remote = "https://image.tmdb.org/t/p/w500/a.jpg";

describe("posterSources", () => {
  it("tries the cached file first, then the provider URL", () => {
    const snap = { poster_file: "tmdb_tv_7.jpg", poster_path: remote };
    expect(posterSources(snap, "/data/posters", toSrc)).toEqual([
      "asset:///data/posters/tmdb_tv_7.jpg",
      remote,
    ]);
  });

  it("uses the Windows separator when the folder has one", () => {
    const snap = { poster_file: "a.jpg", poster_path: null };
    expect(posterSources(snap, "C:\\Users\\u\\posters", toSrc)).toEqual([
      "asset://C:\\Users\\u\\posters\\a.jpg",
    ]);
  });

  it("falls back to the provider URL when nothing is cached or the folder is unknown", () => {
    expect(posterSources({ poster_file: null, poster_path: remote }, "/d", toSrc)).toEqual([
      remote,
    ]);
    expect(posterSources({ poster_file: "a.jpg", poster_path: remote }, null, toSrc)).toEqual([
      remote,
    ]);
  });

  it("is empty when there is no poster at all", () => {
    expect(posterSources({ poster_file: null, poster_path: null }, "/d", toSrc)).toEqual([]);
  });
});
