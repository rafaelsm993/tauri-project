import { describe, expect, it } from "vitest";
import { formatHours } from "./chartTheme";

describe("formatHours", () => {
  it("keeps one decimal under 10 hours and rounds above", () => {
    expect(formatHours(0)).toBe("0");
    expect(formatHours(1.5)).toBe("1.5");
    expect(formatHours(2.04)).toBe("2");
    expect(formatHours(13.5)).toBe("14");
    expect(formatHours(140.2)).toBe("140");
  });
});
