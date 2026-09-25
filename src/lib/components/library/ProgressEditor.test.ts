import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ProgressEditor from "./ProgressEditor.svelte";

const base = {
  mediaType: "tv" as const,
  progress: 3,
  total: 12 as number | null,
  rating: null as number | null,
  onprogress: vi.fn(),
  onrating: vi.fn(),
};

describe("ProgressEditor", () => {
  it("labels progress in the unit of the media type", () => {
    render(ProgressEditor, { ...base });
    expect(screen.getByText("3 of 12 episodes")).toBeInTheDocument();
  });

  it("reports a whole-number progress change", async () => {
    const onprogress = vi.fn();
    render(ProgressEditor, { ...base, onprogress });
    const field = screen.getByLabelText(/progress/i);
    await userEvent.clear(field);
    await userEvent.type(field, "7");
    expect(onprogress).toHaveBeenLastCalledWith(7);
  });

  it("shows no progress control for a movie, whose status already says it", () => {
    render(ProgressEditor, { ...base, mediaType: "movie", progress: 0, total: 1 });
    expect(screen.queryByLabelText(/progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/watched/i)).not.toBeInTheDocument();
  });

  it("hides the bar when the total is unknown", () => {
    render(ProgressEditor, { ...base, mediaType: "manga", progress: 41, total: null });
    expect(screen.getByText("41 chapters")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a bar at the right percentage when the total is known", () => {
    render(ProgressEditor, { ...base, progress: 6, total: 12 });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("offers ratings 1 to 10 and reports the chosen one", async () => {
    const onrating = vi.fn();
    render(ProgressEditor, { ...base, onrating });
    await userEvent.click(screen.getByRole("button", { name: "8" }));
    expect(onrating).toHaveBeenLastCalledWith(8);
  });

  it("reports an unrated selection as null", async () => {
    const onrating = vi.fn();
    render(ProgressEditor, { ...base, rating: 8, onrating });
    await userEvent.click(screen.getByRole("button", { name: /unrated/i }));
    expect(onrating).toHaveBeenLastCalledWith(null);
  });

  it("hints that length is missing instead of showing an error", () => {
    render(ProgressEditor, {
      ...base,
      mediaType: "book",
      progress: 12,
      total: null,
      plannable: false,
    });
    expect(screen.getByText(/length unknown/i)).toBeInTheDocument();
  });

  it("shows no hint once the item is plannable", () => {
    render(ProgressEditor, { ...base, plannable: true });
    expect(screen.queryByText(/length unknown/i)).not.toBeInTheDocument();
  });

  it("offers to add length when the item is not plannable", async () => {
    const onaddlength = vi.fn();
    render(ProgressEditor, { ...base, plannable: false, onaddlength });
    await userEvent.click(screen.getByRole("button", { name: /add length/i }));
    expect(onaddlength).toHaveBeenCalledOnce();
  });
});
