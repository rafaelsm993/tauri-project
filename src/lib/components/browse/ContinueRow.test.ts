import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import ContinueRow from "./ContinueRow.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";

const entry = (id: number): LibraryEntry => ({
  key: `tmdb:movie:${id}`,
  snapshot: {
    media_key: `tmdb:movie:${id}`,
    provider: "tmdb",
    media_type: "movie",
    title: `Dune ${id}`,
    poster_path: null,
    poster_file: null,
    year: "2021",
  },
  user: {
    status: "in_progress",
    progress: 0,
    rating: null,
    review: null,
    length: emptyLength(),
    plan: null,
  },
  created_at: "t",
  updated_at: "t",
});

const plain = (e: LibraryEntry) => ({ entry: e, dueMinutes: null });

describe("ContinueRow", () => {
  it("lists what you are in the middle of under a Continue heading", () => {
    render(ContinueRow, { items: [entry(1), entry(2)].map(plain), posterDir: null });
    const row = screen.getByRole("region", { name: "Continue" });
    expect(within(row).getAllByRole("listitem")).toHaveLength(2);
    expect(within(row).getByRole("link", { name: /Dune 1/ })).toHaveAttribute(
      "href",
      "/media/movie/1",
    );
  });

  it("renders nothing when empty", () => {
    render(ContinueRow, { items: [], posterDir: null });
    expect(screen.queryByRole("region", { name: "Continue" })).toBeNull();
  });

  it("shows the re-planned note and gives a planned card its plan icon and Log session", () => {
    const e = entry(1);
    e.user = { ...e.user, plan: { days: [0], max_session_minutes: 30, since: "2026-09-28" } };
    render(ContinueRow, {
      items: [{ entry: e, dueMinutes: 30 }],
      posterDir: null,
      note: "2 earlier sessions re-planned",
    });
    const row = screen.getByRole("region", { name: "Continue" });
    expect(row).toHaveTextContent("2 earlier sessions re-planned");
    expect(row).toHaveTextContent("30 min today");
    expect(
      within(row).getByRole("button", { name: "Log a session of Dune 1" }),
    ).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Edit plan for Dune 1" })).toBeInTheDocument();
  });

  it("still shows the note on a day with nothing to continue", () => {
    render(ContinueRow, { items: [], posterDir: null, note: "1 earlier session re-planned" });
    expect(screen.getByRole("region", { name: "Continue" })).toHaveTextContent(
      "1 earlier session re-planned",
    );
  });
});
