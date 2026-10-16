import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import PosterPlaceholder from "./PosterPlaceholder.svelte";

describe("PosterPlaceholder", () => {
  it("draws the title's initial on the family hue, hidden from screen readers", () => {
    const { container } = render(PosterPlaceholder, { title: "dune", type: "book" });
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("hue-book");
    expect(root).toHaveTextContent(/^D$/);
  });

  it("uses the shared screen hue for movies and series", () => {
    const { container } = render(PosterPlaceholder, { title: "Arcane", type: "tv" });
    expect(container.firstElementChild).toHaveClass("hue-screen");
  });

  it("carries the poster key, so the poster morph finds it like an image", () => {
    const { container } = render(PosterPlaceholder, {
      title: "Dune",
      type: "book",
      posterKey: "poster-book-1",
    });
    expect(container.querySelector('[data-poster="poster-book-1"]')).toBe(
      container.firstElementChild,
    );
  });

  it("has no poster key unless given one", () => {
    const { container } = render(PosterPlaceholder, { title: "Dune", type: "book" });
    expect(container.querySelector("[data-poster]")).toBeNull();
  });

  it("can show the whole title under the initial", () => {
    const { container } = render(PosterPlaceholder, {
      title: "One Piece",
      type: "manga",
      caption: true,
    });
    expect(container.firstElementChild).toHaveTextContent("O");
    expect(container.querySelector(".placeholder__caption")).toHaveTextContent("One Piece");
  });
});
