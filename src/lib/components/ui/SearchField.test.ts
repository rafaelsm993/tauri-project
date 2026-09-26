import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SearchField from "./SearchField.svelte";

function setup(value = "") {
  const onchange = vi.fn();
  render(SearchField, { label: "Search your library", value, onchange });
  return { onchange, input: screen.getByRole("searchbox", { name: "Search your library" }) };
}

describe("SearchField", () => {
  it("is a labelled searchbox showing the given value", () => {
    const { input } = setup("dark");
    expect(input).toHaveValue("dark");
  });

  it("reports every keystroke", async () => {
    const { input, onchange } = setup();
    await userEvent.type(input, "ab");
    expect(onchange).toHaveBeenNthCalledWith(1, "a");
    expect(onchange).toHaveBeenNthCalledWith(2, "ab");
  });

  it("offers a clear button only when there is text", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("the clear button empties it and returns focus to the input", async () => {
    const { input, onchange } = setup("dark");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onchange).toHaveBeenCalledWith("");
    expect(input).toHaveFocus();
  });

  it("Escape empties it", async () => {
    const { input, onchange } = setup("dark");
    input.focus();
    await userEvent.keyboard("{Escape}");
    expect(onchange).toHaveBeenCalledWith("");
  });
});
