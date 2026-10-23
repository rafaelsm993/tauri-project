import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import MultiSelect from "./MultiSelect.svelte";

describe("MultiSelect, compacted", () => {
  it("keeps its name for a screen reader when the label is only shown to icons", () => {
    // On a 360px header the words "Genres" squeezed the search field down to a few characters,
    // so narrow widths show the icon alone. The name must survive that, or the control becomes
    // unreachable by voice and unreadable by a screen reader.
    render(MultiSelect, { label: "Genres", options: [], selected: [], onchange: () => {} });
    const trigger = screen.getByRole("button", { name: /^Genres/ });
    expect(trigger.querySelector("svg.ms-trigger__icon")).not.toBeNull();
    expect(trigger.textContent).toContain("Genres");
  });

  it("still shows how many are picked", () => {
    render(MultiSelect, {
      label: "Genres",
      options: [{ value: 1, label: "Action" }],
      selected: [1],
      onchange: () => {},
    });
    expect(screen.getByRole("button", { name: /Genres/ }).textContent).toContain("1");
  });
});

const options = [
  { value: 28, label: "Action" },
  { value: 35, label: "Comedy" },
  { value: "drama", label: "Drama" },
];

function setup(selected: (string | number)[] = [], disabled = false) {
  const onchange = vi.fn();
  const r = render(MultiSelect, { label: "Genres", options, selected, onchange, disabled });
  return { onchange, trigger: screen.getByRole("button", { name: /^Genres/ }), ...r };
}

describe("MultiSelect", () => {
  it("trigger shows the label, plus the count when something is selected", async () => {
    const { trigger, rerender } = setup();
    expect(trigger).toHaveTextContent(/^Genres$/);
    await rerender({ selected: [28, "drama"] });
    // The count is its own badge rather than "Genres · 2", so it survives the label being
    // hidden on a narrow header while the name still reads "Genres".
    expect(trigger.querySelector(".ms-trigger__count")).toHaveTextContent("2");
    expect(trigger).toHaveAccessibleName(/Genres/);
  });

  it("trigger controls the panel and reflects its open state", () => {
    const { trigger } = setup();
    const panelId = trigger.getAttribute("popovertarget");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toHaveAttribute("popover", "auto");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders one checkbox per option, checked from `selected`, in a labelled group", () => {
    setup([35]);
    const group = screen.getByRole("group", { name: "Genres", hidden: true });
    const boxes = within(group).getAllByRole("checkbox", { hidden: true });
    expect(
      boxes.map((b) => b.getAttribute("aria-label") ?? b.closest("label")?.textContent?.trim()),
    ).toEqual(["Action", "Comedy", "Drama"]);
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([false, true, false]);
  });

  it("toggling emits the next selection with original value types, in option order", async () => {
    const { onchange } = setup([35]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Drama", hidden: true }));
    expect(onchange).toHaveBeenLastCalledWith([35, "drama"]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Action", hidden: true }));
    expect(onchange).toHaveBeenLastCalledWith([28, 35]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Comedy", hidden: true }));
    expect(onchange).toHaveBeenLastCalledWith([]);
  });

  it("'Clear' clears everything and only shows when something is selected", async () => {
    const { onchange, rerender } = setup([28, 35]);
    await userEvent.click(screen.getByRole("button", { name: "Clear", hidden: true }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith([]);
    await rerender({ selected: [] });
    expect(screen.queryByRole("button", { name: "Clear", hidden: true })).toBeNull();
  });

  it("can be disabled", () => {
    const { trigger } = setup([], true);
    expect(trigger).toBeDisabled();
  });
});
