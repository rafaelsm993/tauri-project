import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import GenreCarousel from "./GenreCarousel.svelte";

describe("GenreCarousel", () => {
  it("offers a retry button when its row failed to load", async () => {
    const onRetry = vi.fn();
    render(GenreCarousel, {
      title: "Action",
      items: [],
      error: "HTTP 429",
      onCardClick: () => {},
      onRetry,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/HTTP 429/);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no retry button without an error", () => {
    render(GenreCarousel, { title: "Action", items: [], onCardClick: () => {}, onRetry: () => {} });
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("is a list only while it shows cards", () => {
    const base = { title: "Action", onCardClick: () => {} };
    const { unmount } = render(GenreCarousel, { ...base, items: [], loading: true });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    unmount();
    const item = {
      id: 1,
      provider: "tmdb",
      media_key: "tmdb:movie:1",
      title: "Dune",
      overview: "",
      poster_path: null,
      backdrop_path: null,
      vote_average: 8,
      vote_count: 1,
      release_date: "2021-10-22",
      genre_ids: [],
      media_type: "movie",
    } as never;
    render(GenreCarousel, { ...base, items: [item] });
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
