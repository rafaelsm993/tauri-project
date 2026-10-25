import { render, screen, cleanup } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import ProfileArtwork from "./ProfileArtwork.svelte";
import { PROFILE_ART, artworkPaths } from "$lib/domain/profileArt";

afterEach(cleanup);

describe("ProfileArtwork baseline renderer", () => {
  it.each(PROFILE_ART)("renders $name with the native nav pixels and an accessible name", (art) => {
    render(ProfileArtwork, { art: art.id, size: 24 });
    const svg = screen.getByRole("img", { name: `${art.name} artwork` });
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
    expect([...svg.querySelectorAll("path")].map((path) => path.getAttribute("d"))).toEqual(
      artworkPaths(art.id, 24).map((path) => path.d),
    );
  });

  it("uses the distinct profile grid at whole-pixel double scale", () => {
    render(ProfileArtwork, { art: "book:1", size: 32, scale: 2 });
    const svg = screen.getByRole("img", { name: "Bound Archivist artwork" });
    expect(svg.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(svg.getAttribute("width")).toBe("64");
    expect(svg.getAttribute("height")).toBe("64");
    expect([...svg.querySelectorAll("path")].map((path) => path.getAttribute("d"))).toEqual(
      artworkPaths("book:1", 32).map((path) => path.d),
    );
  });

  it("can be decorative inside the already-labelled Profile link", () => {
    const { container } = render(ProfileArtwork, { art: "game:1", size: 24, decorative: true });
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")?.hasAttribute("aria-label")).toBe(false);
  });

  it.each(["default", "unknown:1", "movie:3"])("leaves %s to the parent's default glyph", (art) => {
    const { container } = render(ProfileArtwork, { art });
    expect(container.querySelector("svg")).toBeNull();
  });

  it("updates native art and size without a canvas, animation or document mutation", async () => {
    const before = document.documentElement.style.cssText;
    const { container, rerender } = render(ProfileArtwork, { art: "movie:1", size: 24 });
    await rerender({ art: "tv:1", size: 32 });
    const svg = screen.getByRole("img", { name: "Signal Keeper artwork" });
    expect(svg.getAttribute("width")).toBe("32");
    expect(container.querySelector("canvas, animate, filter, image, script")).toBeNull();
    expect(document.documentElement.style.cssText).toBe(before);
    expect(container.querySelectorAll("path")).toHaveLength(5);
  });
});
