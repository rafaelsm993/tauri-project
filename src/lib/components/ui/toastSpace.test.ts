import { afterEach, describe, expect, it } from "vitest";
import { release, reserve } from "./toastSpace";

const covered = () => document.documentElement.style.getPropertyValue("--toast-covered");

afterEach(() => {
  release("a");
  release("b");
});

describe("toast space", () => {
  it("reserves the tallest space any open toast covers", () => {
    reserve("a", 120);
    reserve("b", 200);
    expect(covered()).toBe("200px");
    release("b");
    expect(covered()).toBe("120px");
  });

  it("gives the space back when the last toast closes", () => {
    reserve("a", 120);
    release("a");
    expect(covered()).toBe("");
  });
});
