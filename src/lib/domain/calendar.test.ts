import { describe, expect, it } from "vitest";
import { addDays, dayNumber, isDay, weekday, weekStart } from "./calendar";

describe("calendar", () => {
  it.each([
    ["2026-09-28", 0],
    ["2026-10-01", 3],
    ["2026-10-04", 6],
    ["2024-02-29", 3],
  ])("%s is weekday %i (0 = Monday)", (date, day) => {
    expect(weekday(date)).toBe(day);
  });

  it.each([
    ["2026-10-01", 1, "2026-10-02"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2024-02-28", 1, "2024-02-29"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-10-25", 1, "2026-10-26"],
  ])("%s plus %i day is %s", (date, n, out) => {
    expect(addDays(date, n)).toBe(out);
  });

  it("days are whole numbers one apart across a DST change", () => {
    expect(dayNumber("2026-10-26") - dayNumber("2026-10-25")).toBe(1);
    expect(dayNumber("2026-03-30") - dayNumber("2026-03-29")).toBe(1);
  });

  it("the week starts on Monday", () => {
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
  });

  it("only YYYY-MM-DD is a day", () => {
    expect(isDay("2026-10-01")).toBe(true);
    expect(isDay("2026-10-01T00:00")).toBe(false);
    expect(isDay("")).toBe(false);
  });
});
