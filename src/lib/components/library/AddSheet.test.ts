import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import AddSheet from "./AddSheet.svelte";
import { emptyLength } from "$lib/domain/length";

const base = {
  mediaType: "book" as const,
  title: "Dune",
  length: emptyLength(),
  review: null as string | null,
  onsave: vi.fn(),
  oncancel: vi.fn(),
};

describe("AddSheet", () => {
  it("starts a manga's minutes per chapter from Settings and says so", async () => {
    const onsave = vi.fn();
    render(AddSheet, {
      ...base,
      mediaType: "manga",
      length: { ...emptyLength(), chapters: 232 },
      chapterMinutes: 22,
      onsave,
    });
    const field = screen.getByLabelText("Minutes per chapter");
    expect(field).toHaveValue(22);
    expect(field).toHaveAccessibleDescription(
      "Filled in from Settings. Change it here for just this manga.",
    );
    await userEvent.click(screen.getByRole("button", { name: /^save/i }));
    expect(onsave.mock.calls[0][0].length.chapter_minutes).toBe(22);
    await userEvent.clear(field);
    await userEvent.type(field, "25");
    expect(
      screen.queryByText("Filled in from Settings. Change it here for just this manga."),
    ).not.toBeInTheDocument();
  });

  it("keeps a manga's own minutes per chapter, with no note", () => {
    render(AddSheet, {
      ...base,
      mediaType: "manga",
      length: { ...emptyLength(), chapters: 232, chapter_minutes: 20 },
      chapterMinutes: 22,
    });
    expect(screen.getByLabelText("Minutes per chapter")).toHaveValue(20);
    expect(
      screen.queryByText("Filled in from Settings. Change it here for just this manga."),
    ).not.toBeInTheDocument();
  });

  it("asks only for the fields its family needs", () => {
    render(AddSheet, { ...base });
    expect(screen.getByLabelText(/pages/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/hours to finish/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/minutes per episode/i)).not.toBeInTheDocument();
  });

  it("asks a series for both the count and the minutes per episode", () => {
    render(AddSheet, { ...base, mediaType: "tv" });
    expect(screen.getByLabelText(/^episodes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minutes per episode/i)).toBeInTheDocument();
  });

  it("saves a typical episode length picked with one tap", async () => {
    const onsave = vi.fn();
    render(AddSheet, {
      ...base,
      mediaType: "tv",
      length: { ...emptyLength(), episodes: 73 },
      onsave,
    });
    await userEvent.click(screen.getByRole("button", { name: "60 min" }));
    await userEvent.click(screen.getByRole("button", { name: /^save/i }));
    expect(onsave).toHaveBeenCalledWith({
      length: { ...emptyLength(), episodes: 73, episode_minutes: 60 },
      review: null,
    });
  });

  it("prefills what the provider already knows", () => {
    render(AddSheet, { ...base, mediaType: "tv", length: { ...emptyLength(), episodes: 24 } });
    expect(screen.getByLabelText(/^episodes/i)).toHaveValue(24);
  });

  it("saves the numbers the user typed", async () => {
    const onsave = vi.fn();
    render(AddSheet, { ...base, onsave });
    await userEvent.type(screen.getByLabelText(/pages/i), "350");
    await userEvent.click(screen.getByRole("button", { name: /^save/i }));
    expect(onsave).toHaveBeenCalledWith({
      length: { ...emptyLength(), pages: 350 },
      review: null,
    });
  });

  it("saves with nothing filled in, because length is never required", async () => {
    const onsave = vi.fn();
    render(AddSheet, { ...base, onsave });
    await userEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(onsave).toHaveBeenCalledWith({ length: emptyLength(), review: null });
  });

  it("carries a review through", async () => {
    const onsave = vi.fn();
    render(AddSheet, { ...base, onsave });
    await userEvent.type(screen.getByLabelText(/review/i), "Still the best.");
    await userEvent.click(screen.getByRole("button", { name: /^save/i }));
    expect(onsave).toHaveBeenCalledWith({
      length: emptyLength(),
      review: "Still the best.",
    });
  });

  it("says why the fields are wanted, without demanding them", () => {
    render(AddSheet, { ...base });
    expect(screen.getByText(/plan/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("can be dismissed", async () => {
    const oncancel = vi.fn();
    render(AddSheet, { ...base, oncancel });
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  it("for a saved item, says Edit and offers no Skip", () => {
    render(AddSheet, { ...base, saved: true });
    expect(screen.getByRole("heading", { name: "Edit Dune" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/add it later/i)).not.toBeInTheDocument();
  });

  it("for a new item, says Add and offers Skip", () => {
    render(AddSheet, { ...base });
    expect(screen.getByRole("heading", { name: "Add Dune" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });
});
