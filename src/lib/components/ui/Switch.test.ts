import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Switch from "./Switch.svelte";

function setup(checked = false, disabled = false) {
  const onchange = vi.fn();
  render(Switch, {
    label: "Animations",
    hint: "Covers the background.",
    checked,
    disabled,
    onchange,
  });
  return { onchange, sw: screen.getByRole("switch", { name: "Animations" }) };
}

describe("Switch", () => {
  it("is a named switch that says whether it is on", () => {
    expect(setup(true).sw).toHaveAttribute("aria-checked", "true");
  });

  it("is off when not checked", () => {
    expect(setup(false).sw).toHaveAttribute("aria-checked", "false");
  });

  it("describes itself with the hint", () => {
    expect(setup().sw).toHaveAccessibleDescription("Covers the background.");
  });

  it("asks to flip on click", async () => {
    const { sw, onchange } = setup(false);
    await userEvent.click(sw);
    expect(onchange).toHaveBeenCalledWith(true);
  });

  it("flips from the keyboard with Space and Enter", async () => {
    const { sw, onchange } = setup(true);
    sw.focus();
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{Enter}");
    expect(onchange).toHaveBeenNthCalledWith(1, false);
    expect(onchange).toHaveBeenNthCalledWith(2, false);
  });

  it("stops the thumb sliding when motion is off", () => {
    const onchange = vi.fn();
    render(Switch, { label: "Theme", checked: true, motion: false, onchange });
    expect(screen.getByRole("switch", { name: "Theme" })).toHaveClass("still");
  });

  it("does nothing while disabled", async () => {
    const { sw, onchange } = setup(false, true);
    expect(sw).toBeDisabled();
    await userEvent.click(sw);
    expect(onchange).not.toHaveBeenCalled();
  });
});
