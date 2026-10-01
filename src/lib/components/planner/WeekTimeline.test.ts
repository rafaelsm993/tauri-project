import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import WeekTimeline from "./WeekTimeline.svelte";
import type { Day } from "$lib/domain/planner";

const block = (
  key: string,
  title: string,
  family: "anime" | "game",
  minutes: number,
  date: string,
) => ({
  id: `${key}@${date}`,
  key,
  title,
  family,
  minutes,
});

const WEEK: Day[] = [
  { date: "2026-09-28", blocks: [block("a", "Frieren", "anime", 48, "2026-09-28")], total: 48 },
  { date: "2026-09-29", blocks: [], total: 0 },
  { date: "2026-09-30", blocks: [], total: 0 },
  { date: "2026-10-01", blocks: [], total: 0 },
  {
    date: "2026-10-02",
    blocks: [
      block("a", "Frieren", "anime", 48, "2026-10-02"),
      block("g", "Hades", "game", 90, "2026-10-02"),
    ],
    total: 138,
  },
  { date: "2026-10-03", blocks: [], total: 0 },
  { date: "2026-10-04", blocks: [], total: 0 },
];

describe("WeekTimeline", () => {
  it("shows seven labelled days and marks today", () => {
    render(WeekTimeline, { days: WEEK, today: "2026-10-01", motion: false });
    const cols = screen.getAllByRole("listitem", { name: /^(mon|tue|wed|thu|fri|sat|sun),/i });
    expect(cols).toHaveLength(7);
    expect(cols[0]).toHaveAccessibleName("Mon, Sep 28");
    expect(cols[3]).toHaveAttribute("aria-current", "date");
    expect(cols.filter((c) => c.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("names each session block and shows the day's total", () => {
    render(WeekTimeline, { days: WEEK, today: "2026-10-01", motion: false });
    const fri = screen.getByRole("listitem", { name: "Fri, Oct 2" });
    expect(within(fri).getByText("Frieren")).toBeInTheDocument();
    expect(within(fri).getByLabelText("Hades, 1 h 30 min")).toBeInTheDocument();
    expect(within(fri).getByText("2 h 18 min")).toBeInTheDocument();
  });

  it("dims the days already past, without hiding them", () => {
    render(WeekTimeline, { days: WEEK, today: "2026-10-01", motion: false });
    const mon = screen.getByRole("listitem", { name: "Mon, Sep 28" });
    expect(mon).toHaveClass("past");
    expect(within(mon).getByText("Frieren")).toBeVisible();
    expect(screen.getByRole("listitem", { name: "Fri, Oct 2" })).not.toHaveClass("past");
  });

  it("says a free day is free", () => {
    render(WeekTimeline, { days: WEEK, today: "2026-10-01", motion: false });
    expect(
      within(screen.getByRole("listitem", { name: "Sat, Oct 3" })).getByText("Free"),
    ).toBeInTheDocument();
  });
});
