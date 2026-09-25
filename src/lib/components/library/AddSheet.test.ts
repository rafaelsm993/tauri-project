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
});
