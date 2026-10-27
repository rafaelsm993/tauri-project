import { render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import RewardPicker from "./RewardPicker.svelte";

const options = [
  { value: "default", label: "Default", hint: "Available", disabled: false },
  { value: "ember", label: "Ember", hint: "Available", disabled: false },
  { value: "ocean", label: "Ocean", hint: "Requires level 20", disabled: true },
];

function expose(container: HTMLElement) {
  container.querySelectorAll("[popover]").forEach((node) => node.removeAttribute("popover"));
}

it("names the closed trigger from the field and effective selection", () => {
  render(RewardPicker, { label: "Accent", value: "default", options, onchange: vi.fn() });
  const trigger = screen.getByRole("button", { name: "Accent: Default" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveAttribute("aria-controls", trigger.getAttribute("popovertarget"));
  expect(trigger.querySelector("input")).toBeNull();
});

it("keeps unavailable options described and never calls selection for them", async () => {
  const onchange = vi.fn(async () => true);
  const { container } = render(RewardPicker, {
    label: "Accent",
    value: "default",
    options,
    onchange,
  });
  expose(container);
  const ocean = screen.getByRole("button", { name: "Ocean" });
  expect(ocean).toBeDisabled();
  expect(ocean).toHaveAccessibleDescription("Requires level 20");
  await userEvent.click(ocean);
  expect(onchange).not.toHaveBeenCalled();
});

it("emits an eligible choice, but not the already selected choice", async () => {
  const onchange = vi.fn(async () => true);
  const { container } = render(RewardPicker, {
    label: "Accent",
    value: "default",
    options,
    onchange,
  });
  expose(container);
  await userEvent.click(screen.getByRole("button", { name: "Default" }));
  expect(onchange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Ember" }));
  expect(onchange).toHaveBeenCalledExactlyOnceWith("ember");
  expect(screen.getByRole("button", { name: "Accent: Default" })).toHaveFocus();
});

it("disables trigger and choices while the caller is saving", () => {
  const { container } = render(RewardPicker, {
    label: "Accent",
    value: "default",
    options,
    disabled: true,
    onchange: vi.fn(),
  });
  expose(container);
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
});

it("marks only the effective selection as pressed without a checkbox", () => {
  const { container } = render(RewardPicker, {
    label: "Accent",
    value: "ember",
    options,
    onchange: vi.fn(),
  });
  expose(container);
  expect(screen.getByRole("button", { name: "Ember" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Default" })).toHaveAttribute("aria-pressed", "false");
  expect(container.querySelectorAll('input[type="checkbox"],input[type="radio"]')).toHaveLength(0);
});

it("allows an explicit reset when the caller retains a different unavailable choice", async () => {
  const onchange = vi.fn(async () => true);
  const { container } = render(RewardPicker, {
    label: "Accent",
    value: "default",
    options,
    allowReselect: true,
    onchange,
  });
  expose(container);
  await userEvent.click(screen.getByRole("button", { name: "Default" }));
  expect(onchange).toHaveBeenCalledExactlyOnceWith("default");
});
