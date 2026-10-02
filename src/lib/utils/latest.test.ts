import { describe, expect, it } from "vitest";
import { latest } from "./latest";

describe("latest", () => {
  it("keeps a call current while nothing newer started", () => {
    const begin = latest();
    const isCurrent = begin();
    expect(isCurrent()).toBe(true);
  });

  it("makes an older call stale once a newer one starts", () => {
    const begin = latest();
    const first = begin();
    const second = begin();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it("keeps separate sequences apart", () => {
    const a = latest();
    const b = latest();
    const fromA = a();
    b();
    expect(fromA()).toBe(true);
  });
});
