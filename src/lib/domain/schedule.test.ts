import { describe, expect, it } from "vitest";
import { schedule, type Conditions } from "./schedule";

const MWF: Conditions = { days: [0, 2, 4], maxSessionMinutes: 120 };
const dates = (s: ReturnType<typeof schedule>) =>
  s.kind === "planned" ? s.sessions.map((x) => x.date) : [];

describe("schedule", () => {
  it("spreads the work evenly over the allowed days, starting today if allowed", () => {
    const s = schedule(300, MWF, "2026-09-28");
    expect(s).toMatchObject({
      kind: "planned",
      sessions: [
        { date: "2026-09-28", minutes: 100 },
        { date: "2026-09-30", minutes: 100 },
        { date: "2026-10-02", minutes: 100 },
      ],
      finish: "2026-10-02",
    });
  });

  it("skips days that are not allowed", () => {
    expect(dates(schedule(240, MWF, "2026-10-01"))).toEqual(["2026-10-02", "2026-10-05"]);
  });

  it("no session is longer than the cap and the minutes add up", () => {
    for (const [left, cap] of [
      [301, 120],
      [1, 30],
      [599, 60],
      [1680, 90],
    ]) {
      const s = schedule(
        left,
        { days: [0, 1, 2, 3, 4, 5, 6], maxSessionMinutes: cap },
        "2026-10-01",
      );
      if (s.kind !== "planned") throw new Error(s.kind);
      expect(s.sessions.every((x) => x.minutes <= cap && x.minutes > 0)).toBe(true);
      expect(s.sessions.reduce((sum, x) => sum + x.minutes, 0)).toBe(left);
    }
  });

  it("weekly targets group the sessions by Monday", () => {
    const s = schedule(480, MWF, "2026-09-30");
    expect(s).toMatchObject({
      weekly: [
        { week: "2026-09-28", minutes: 240 },
        { week: "2026-10-05", minutes: 240 },
      ],
    });
  });

  it("crosses a month and a DST change without skipping a day", () => {
    expect(
      dates(schedule(60 * 3, { days: [5, 6, 0], maxSessionMinutes: 60 }, "2026-10-24")),
    ).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("nothing left, no days or no time each say so", () => {
    expect(schedule(0, MWF, "2026-10-01")).toEqual({ kind: "done" });
    expect(schedule(-5, MWF, "2026-10-01")).toEqual({ kind: "done" });
    expect(schedule(60, { days: [], maxSessionMinutes: 60 }, "2026-10-01")).toEqual({
      kind: "impossible",
      reason: "no-days",
    });
    expect(schedule(60, { days: [0], maxSessionMinutes: 0 }, "2026-10-01")).toEqual({
      kind: "impossible",
      reason: "no-time",
    });
  });

  it("re-planning is the same call with what is left and from when", () => {
    const first = schedule(600, MWF, "2026-09-28");
    const later = schedule(500, MWF, "2026-10-05");
    if (first.kind !== "planned" || later.kind !== "planned") throw new Error("not planned");
    expect(first.finish).toBe("2026-10-07");
    expect(later.finish).toBe("2026-10-14");
  });

  it("duplicate days count once", () => {
    expect(dates(schedule(120, { days: [0, 0, 0], maxSessionMinutes: 60 }, "2026-09-28"))).toEqual([
      "2026-09-28",
      "2026-10-05",
    ]);
  });
});
