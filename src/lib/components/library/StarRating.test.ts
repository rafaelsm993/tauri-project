import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import StarRating from "./StarRating.svelte";

// Five equal 34 px cells: x / 170 × 10, rounded up, is the value.
function setup(value: number | null, disabled = false) {
  const onchange = vi.fn();
  const view = render(StarRating, { value, onchange, disabled });
  const slider = screen.getByRole("slider", { name: "Rating" });
  vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({ left: 0, width: 170 } as DOMRect);
  slider.setPointerCapture = vi.fn();
  const fills = () =>
    [...view.container.querySelectorAll(".star")].map((s) => s.getAttribute("data-fill"));
  const tap = async (x: number) => {
    await fireEvent.pointerDown(slider, { pointerId: 1, clientX: x });
    await fireEvent.pointerUp(slider, { pointerId: 1, clientX: x });
  };
  return { onchange, slider, fills, tap, view };
}

describe("StarRating", () => {
  it("is a 0–10 slider that says the value and its word", () => {
    const { slider, fills } = setup(7);
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "10");
    expect(slider).toHaveAttribute("aria-valuenow", "7");
    expect(slider).toHaveAttribute("aria-valuetext", "7 · Good");
    expect(screen.getByText("7 · Good")).toHaveClass("rating-word");
    expect(fills()).toEqual(["full", "full", "full", "half", "empty"]);
  });

  it("shows empty stars and Not rated without a rating", () => {
    const { slider, fills } = setup(null);
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Not rated")).toBeInTheDocument();
    expect(fills()).toEqual(["empty", "empty", "empty", "empty", "empty"]);
  });

  it("rates the half star tapped", async () => {
    const { onchange, tap } = setup(null);
    await tap(110);
    expect(onchange).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("clears when the current value is tapped again", async () => {
    const { onchange, tap } = setup(7);
    await tap(110);
    expect(onchange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("follows a drag across the stars and saves once, on release", async () => {
    const { onchange, slider } = setup(2);
    await fireEvent.pointerDown(slider, { pointerId: 1, clientX: 5 });
    await fireEvent.pointerMove(slider, { pointerId: 1, clientX: 60 });
    await fireEvent.pointerMove(slider, { pointerId: 1, clientX: 169 });
    expect(slider).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByText("10 · Masterpiece")).toBeInTheDocument();
    expect(onchange).not.toHaveBeenCalled();
    await fireEvent.pointerUp(slider, { pointerId: 1, clientX: 169 });
    expect(onchange).toHaveBeenCalledExactlyOnceWith(10);
    expect(slider.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it("doesn't clear when a drag wanders back to where it started", async () => {
    const { onchange, slider } = setup(3);
    await fireEvent.pointerDown(slider, { pointerId: 1, clientX: 40 });
    await fireEvent.pointerMove(slider, { pointerId: 1, clientX: 90 });
    await fireEvent.pointerMove(slider, { pointerId: 1, clientX: 40 });
    await fireEvent.pointerUp(slider, { pointerId: 1, clientX: 40 });
    expect(onchange).not.toHaveBeenCalled();
  });

  it("drops a drag the system cancels", async () => {
    const { onchange, slider } = setup(3);
    await fireEvent.pointerDown(slider, { pointerId: 1, clientX: 150 });
    await fireEvent.pointerCancel(slider, { pointerId: 1 });
    await fireEvent.pointerUp(slider, { pointerId: 1, clientX: 150 });
    expect(slider).toHaveAttribute("aria-valuenow", "3");
    expect(onchange).not.toHaveBeenCalled();
  });

  it("takes the arrow keys, Home, End and Delete", async () => {
    const { onchange, slider } = setup(7);
    slider.focus();
    const user = userEvent.setup();
    for (const [key, value] of [
      ["{ArrowRight}", 8],
      ["{ArrowLeft}", 6],
      ["{PageUp}", 9],
      ["{End}", 10],
      ["{Home}", 1],
      ["{Delete}", null],
    ] as const) {
      await user.keyboard(key);
      expect(onchange).toHaveBeenLastCalledWith(value);
    }
  });

  it("does nothing while disabled", async () => {
    const { onchange, slider, tap } = setup(4, true);
    expect(slider).toHaveAttribute("aria-disabled", "true");
    expect(slider).toHaveAttribute("tabindex", "-1");
    await tap(150);
    await fireEvent.keyDown(slider, { key: "End" });
    expect(onchange).not.toHaveBeenCalled();
  });

  it("pops and sparks only the stars a raise lights up", async () => {
    const { tap, view } = setup(2);
    await tap(110); // 2 → 7: stars 2, 3 and the half of 4 light up
    expect(view.container.querySelectorAll(".sprite.pop")).toHaveLength(3);
    expect(view.container.querySelectorAll(".sparks")).toHaveLength(3);
  });

  it("plays nothing when the rating goes down", async () => {
    const { tap, view } = setup(9);
    await tap(40);
    expect(view.container.querySelectorAll(".sprite.pop")).toHaveLength(0);
  });
});
