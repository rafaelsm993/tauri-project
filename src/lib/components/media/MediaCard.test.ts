import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import MediaCard from "./MediaCard.svelte";
import type { MediaItem } from "$lib/types/media";

const manga: MediaItem = {
  id: 30013,
  provider: "anilist",
  media_key: "anilist:manga:30013",
  title: "One Piece",
  overview: "",
  poster_path: null,
  backdrop_path: null,
  vote_average: 0,
  vote_count: 0,
  media_type: "manga",
  chapters: 1100,
};

describe("MediaCard", () => {
  it("labels chapters in English", () => {
    render(MediaCard, { item: manga });
    expect(screen.getByText("1100 ch.")).toBeInTheDocument();
    expect(screen.queryByText(/caps/)).toBeNull();
  });
});
