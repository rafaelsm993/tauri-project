import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import DetailHero from "./DetailHero.svelte";

const base = { title: "Dune", tagline: "", backdropUrl: null, onBack: vi.fn() };

describe("DetailHero poster", () => {
  it("shows the poster image when there is one", () => {
    const { container } = render(DetailHero, {
      ...base,
      type: "book",
      posterUrl: "https://example.com/p.jpg",
      posterKey: "poster-book-1",
    });
    expect(container.querySelector("img.hero-poster")).toHaveAttribute(
      "data-poster",
      "poster-book-1",
    );
    expect(container.querySelector(".placeholder")).toBeNull();
  });

  it("draws the placeholder in the poster's place without one, keyed for the morph", () => {
    const { container } = render(DetailHero, { ...base, type: "book", posterKey: "poster-book-1" });
    const placeholder = container.querySelector(".hero-poster .placeholder");
    expect(placeholder).toHaveClass("hue-book");
    expect(placeholder).toHaveTextContent(/^D$/);
    expect(placeholder).toHaveAttribute("data-poster", "poster-book-1");
  });
});
