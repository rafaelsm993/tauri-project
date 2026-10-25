import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ProgressEditor from "./ProgressEditor.svelte";

const base = {
  mediaType: "manga" as const,
  progress: 12,
  total: 232 as number | null,
  status: "in_progress" as const,
  rating: null as number | null,
  onprogress: vi.fn(),
  onrating: vi.fn(),
};

describe("ProgressEditor", () => {
  it("shows a big count of the total and the status badge", () => {
    render(ProgressEditor, { ...base });
    expect(screen.getByText("12")).toHaveClass("count-now");
    expect(screen.getByText("/ 232 chapters")).toBeInTheDocument();
    expect(document.querySelector(".status-badge")).toHaveTextContent("Status: In progress");
  });

  it("offers the bar as a slider from 0 to the total", () => {
    render(ProgressEditor, { ...base });
    const bar = screen.getByRole("slider", { name: "Progress" });
    expect(bar).toHaveAttribute("min", "0");
    expect(bar).toHaveAttribute("max", "232");
    expect(bar).toHaveValue("12");
    expect(bar).toHaveAttribute("aria-valuetext", "12 of 232 chapters");
  });

  it("follows a drag without saving, and saves once on release", async () => {
    const onprogress = vi.fn();
    render(ProgressEditor, { ...base, onprogress });
    const bar = screen.getByRole("slider", { name: "Progress" });
    await fireEvent.input(bar, { target: { value: "100" } });
    expect(screen.getByText("100")).toHaveClass("count-now");
    expect(onprogress).not.toHaveBeenCalled();
    await fireEvent.change(bar, { target: { value: "100" } });
    expect(onprogress).toHaveBeenCalledExactlyOnceWith(100);
  });

  it("shows the saved value again after a release, so a refused save doesn't stick", async () => {
    render(ProgressEditor, { ...base });
    const bar = screen.getByRole("slider", { name: "Progress" });
    await fireEvent.input(bar, { target: { value: "100" } });
    await fireEvent.change(bar, { target: { value: "100" } });
    expect(screen.getByText("12")).toHaveClass("count-now");
  });

  it("saves nothing when a drag ends where it started", async () => {
    const onprogress = vi.fn();
    render(ProgressEditor, { ...base, onprogress });
    const bar = screen.getByRole("slider", { name: "Progress" });
    await fireEvent.input(bar, { target: { value: "40" } });
    await fireEvent.change(bar, { target: { value: "12" } });
    expect(onprogress).not.toHaveBeenCalled();
  });

  it("steps one unit with − and +", async () => {
    const onprogress = vi.fn();
    render(ProgressEditor, { ...base, onprogress });
    await userEvent.click(screen.getByRole("button", { name: "One chapter more" }));
    expect(onprogress).toHaveBeenLastCalledWith(13);
    await userEvent.click(screen.getByRole("button", { name: "One chapter less" }));
    expect(onprogress).toHaveBeenLastCalledWith(11);
  });

  it("stops − at zero and + at the total", () => {
    const { unmount } = render(ProgressEditor, { ...base, progress: 0, status: "planning" });
    expect(screen.getByRole("button", { name: "One chapter less" })).toBeDisabled();
    unmount();
    render(ProgressEditor, { ...base, progress: 232, status: "completed" });
    expect(screen.getByRole("button", { name: "One chapter more" })).toBeDisabled();
  });

  it("has no bar and no ceiling without a total, and says how to finish", async () => {
    const onprogress = vi.fn();
    render(ProgressEditor, {
      ...base,
      total: null,
      progress: 41,
      plannable: false,
      onprogress,
      onaddlength: vi.fn(),
    });
    expect(screen.queryByRole("slider")).toBeNull();
    expect(document.querySelector(".count")).toHaveTextContent("41 chapters");
    await userEvent.click(screen.getByRole("button", { name: "One chapter more" }));
    expect(onprogress).toHaveBeenLastCalledWith(42);
    expect(screen.getByText(/Add the length to finish it here/)).toBeInTheDocument();
  });

  it("toggles a movie watched", async () => {
    const onprogress = vi.fn();
    render(ProgressEditor, {
      ...base,
      mediaType: "movie",
      progress: 0,
      total: 1,
      status: "planning",
      onprogress,
    });
    const watched = screen.getByRole("button", { name: "Watched" });
    expect(watched).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("slider")).toBeNull();
    await userEvent.click(watched);
    expect(onprogress).toHaveBeenLastCalledWith(1);
  });

  it("un-watches a watched movie", async () => {
    const onprogress = vi.fn();
    render(ProgressEditor, {
      ...base,
      mediaType: "movie",
      progress: 1,
      total: 1,
      status: "completed",
      onprogress,
    });
    const watched = screen.getByRole("button", { name: "Watched" });
    expect(watched).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(watched);
    expect(onprogress).toHaveBeenLastCalledWith(0);
  });

  it("offers Edit length beside the steppers when the length is known", async () => {
    const onaddlength = vi.fn();
    render(ProgressEditor, { ...base, onaddlength });
    await userEvent.click(screen.getByRole("button", { name: "Edit length" }));
    expect(onaddlength).toHaveBeenCalledOnce();
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

  it("offers to edit the length once it is known", async () => {
    const onaddlength = vi.fn();
    render(ProgressEditor, { ...base, plannable: true, onaddlength });
    await userEvent.click(screen.getByRole("button", { name: "Edit length" }));
    expect(onaddlength).toHaveBeenCalledOnce();
    expect(screen.queryByText(/length unknown/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add length/i })).not.toBeInTheDocument();
  });

  it("highlights adding the length, with the reason, when the catalog can't give it", async () => {
    const onaddlength = vi.fn();
    render(ProgressEditor, {
      ...base,
      plannable: false,
      onaddlength,
      lengthNote: "TMDB doesn't list it.",
    });
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("TMDB doesn't list it.");
    const add = screen.getByRole("button", { name: "Add length" });
    expect(note).toContainElement(add);
    await userEvent.click(add);
    expect(onaddlength).toHaveBeenCalledOnce();
    expect(screen.queryByText("Length unknown.")).not.toBeInTheDocument();
  });

  it("keeps the plain hint when there is no reason to give", () => {
    render(ProgressEditor, { ...base, plannable: false, onaddlength: vi.fn() });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add length" })).toHaveClass("length-link");
  });

  it("drops the note once the length is known", () => {
    render(ProgressEditor, {
      ...base,
      plannable: true,
      onaddlength: vi.fn(),
      lengthNote: "anything",
    });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit length" })).toHaveClass("edit-length");
  });
});
