import { describe, expect, it } from "vitest";
import { forecastLine, inRange, heatmapWeeks, RANGES, withBaseline } from "./dashboard";
import type { WeekPoint } from "./dashboard";

const week = (w: string, total: number): WeekPoint => ({
  week: w,
  total,
  screen: total,
  anime: 0,
  manga: 0,
  book: 0,
  game: 0,
});

describe("range switch", () => {
  it("offers 30 days, 90 days and all", () => {
    expect(RANGES.map((r) => r.label)).toEqual(["30 days", "90 days", "All"]);
  });

  it("keeps the weeks that overlap the range", () => {
    const weeks = ["2026-06-01", "2026-08-24", "2026-08-31", "2026-09-21"].map((w) => week(w, 1));
    expect(inRange(weeks, 30, "2026-09-26").map((w) => w.week)).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-21",
    ]);
    expect(inRange(weeks, null, "2026-09-26")).toHaveLength(4);
  });
});

describe("heatmap", () => {
  it("lays out whole weeks Monday first, ending with today's week", () => {
    const weeks = heatmapWeeks(new Map([["2026-09-24", 3]]), "2026-09-26", 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0][0].date).toBe("2026-09-14");
    expect(weeks[1].map((d) => d.date)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(weeks[1][3]).toEqual({ date: "2026-09-24", count: 3, future: false });
    expect(weeks[1][6].future).toBe(true);
  });
});

describe("forecast line", () => {
  it("continues the running total at the current pace, dashed part only after today", () => {
    const got = forecastLine([week("2026-09-14", 10), week("2026-09-21", 20)], 2, 2);
    expect(got).toEqual([
      { week: "2026-09-07", actual: 0, projected: null },
      { week: "2026-09-14", actual: 10, projected: null },
      { week: "2026-09-21", actual: 30, projected: 30 },
      { week: "2026-09-28", actual: null, projected: 44 },
      { week: "2026-10-05", actual: null, projected: 58 },
    ]);
  });

  it("is empty with no history", () => {
    expect(forecastLine([], 5, 4)).toEqual([]);
  });
});

describe("baseline", () => {
  it("starts a line at zero the week before, so one week of data still draws", () => {
    const got = withBaseline([week("2026-09-21", 30)]);
    expect(got.map((w) => [w.week, w.total, w.screen])).toEqual([
      ["2026-09-14", 0, 0],
      ["2026-09-21", 30, 30],
    ]);
    expect(withBaseline([])).toEqual([]);
  });
});
