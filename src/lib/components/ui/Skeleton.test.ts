import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import Skeleton from "./Skeleton.svelte";

const bars = (c: HTMLElement) => c.querySelectorAll(".skeleton-line");
const posters = (c: HTMLElement) => c.querySelectorAll(".skeleton-poster");

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(Skeleton);
    expect(container.querySelector(".skeleton-block")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws one line and no poster by default", () => {
    const { container } = render(Skeleton);
    expect(bars(container)).toHaveLength(1);
    expect(posters(container)).toHaveLength(0);
  });

  it("draws as many lines as asked", () => {
    const { container } = render(Skeleton, { lines: 3 });
    expect(bars(container)).toHaveLength(3);
  });

  it("draws a poster only when asked", () => {
    const { container } = render(Skeleton, { poster: true, lines: 0 });
    expect(posters(container)).toHaveLength(1);
    expect(bars(container)).toHaveLength(0);
  });

  it("puts a heading and a subtitle before the text lines", () => {
    const { container } = render(Skeleton, { heading: true, lines: 3 });
    expect(container.querySelectorAll(".skeleton-heading")).toHaveLength(1);
    expect(container.querySelectorAll(".skeleton-subtitle")).toHaveLength(1);
    expect(bars(container)).toHaveLength(3);
  });

  it("sets no inline styles", () => {
    const { container } = render(Skeleton, { poster: true, heading: true, lines: 3 });
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });
});
