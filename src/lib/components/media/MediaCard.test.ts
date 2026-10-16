import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import MediaCard from "./MediaCard.svelte";
import type { MediaItem } from "$lib/types/media";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";

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
  it("without a poster draws the family placeholder and keeps the title on it", () => {
    const { container } = render(MediaCard, { item: manga });
    const placeholder = container.querySelector(".card__no-poster .placeholder");
    expect(placeholder).toHaveClass("hue-manga");
    expect(placeholder).toHaveAttribute("data-poster");
    expect(placeholder?.querySelector(".placeholder__caption")).toHaveTextContent("One Piece");
  });

  it("keeps the poster clean: type and rating only, no description or title", () => {
    render(MediaCard, {
      item: {
        ...manga,
        poster_path: "https://example.com/p.jpg",
        overview: "A pirate story.",
        vote_average: 8.4,
        author: "Eiichiro Oda",
      },
    });
    expect(screen.queryByText("A pirate story.")).toBeNull();
    expect(screen.getByText("★ 8.4")).toBeInTheDocument();
    expect(screen.queryByText("Eiichiro Oda")).toBeNull();
    expect(screen.getAllByText("One Piece")).toHaveLength(1);
    expect(screen.getByText("Manga")).toBeInTheDocument();
  });
});

const storeHolding = async (keys: string[]) => {
  const client = {
    load: vi.fn(async () => keys.map((key) => ({ key, snapshot: { media_key: key }, user: {} }))),
    posterDir: vi.fn(async () => "/p"),
  } as unknown as LibraryClient;
  const store = new LibraryStore(client);
  await store.hydrate();
  return store;
};

describe("MediaCard saved badge", () => {
  it("tells you an item is in your library, in its name too", async () => {
    render(MediaCard, { item: manga, store: await storeHolding([manga.media_key]) });
    expect(screen.getByRole("button", { name: "One Piece, in your library" })).toBeInTheDocument();
    expect(screen.getByText("In library")).toBeInTheDocument();
  });

  it("shows no badge for an unsaved item", async () => {
    render(MediaCard, { item: manga, store: await storeHolding([]) });
    expect(screen.queryByText("In library")).toBeNull();
    expect(screen.getByRole("button", { name: /^One Piece/ })).toBeInTheDocument();
  });
});
