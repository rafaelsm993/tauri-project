import { describe, expect, it } from "vitest";
import { firstCategory, typesFor } from "./taste";

describe("typesFor", () => {
  it("expands the screen family into movies and TV", () => {
    expect(typesFor(["screen"])).toEqual(["movie", "tv"]);
  });

  it("maps each simple family to its own type", () => {
    expect(typesFor(["book"])).toEqual(["book"]);
    expect(typesFor(["game"])).toEqual(["game"]);
    expect(typesFor(["anime", "manga"])).toEqual(["anime", "manga"]);
  });

  it("keeps the order the user picked in", () => {
    expect(typesFor(["game", "screen"])).toEqual(["game", "movie", "tv"]);
  });

  it("ignores anything that is not a family", () => {
    expect(typesFor(["book", "nonsense"])).toEqual(["book"]);
  });

  it("has nothing to say about an empty pick", () => {
    expect(typesFor([])).toEqual([]);
  });
});

describe("firstCategory", () => {
  it("opens on what the user picked first", () => {
    expect(firstCategory(["game"])).toBe("game");
    expect(firstCategory(["manga", "book"])).toBe("manga");
  });

  it("opens on movies when the user picked screens", () => {
    expect(firstCategory(["screen"])).toBe("movie");
  });

  it("falls back to the default when nothing was picked", () => {
    expect(firstCategory([])).toBe("movie");
  });

  it("falls back to the default when the saved pick is junk", () => {
    expect(firstCategory(["banana"])).toBe("movie");
  });
});
