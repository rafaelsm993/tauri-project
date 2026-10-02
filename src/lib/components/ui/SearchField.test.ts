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

  it("is not a search landmark in instant mode", () => {
    setup();
    expect(screen.queryByRole("search")).toBeNull();
  });
});

describe("SearchField in submit mode", () => {
  function submit(props: { value?: string; loading?: boolean } = {}) {
    const onchange = vi.fn();
    const onsubmit = vi.fn();
    const onclear = vi.fn();
    const view = render(SearchField, {
      mode: "submit",
      label: "Search the catalog",
      value: props.value ?? "",
      loading: props.loading,
      onchange,
      onsubmit,
      onclear,
    });
    const input = screen.getByRole("searchbox", { name: "Search the catalog" });
    return { onchange, onsubmit, onclear, input, view };
  }

  it("is a search landmark", () => {
    submit();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("submits the trimmed text on Enter", async () => {
    const { input, onsubmit } = submit({ value: "  dune " });
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(onsubmit).toHaveBeenCalledExactlyOnceWith("dune");
  });

  it("submits nothing when the text is blank", async () => {
    const { input, onsubmit } = submit({ value: "   " });
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(onsubmit).not.toHaveBeenCalled();
  });

  it("the clear button empties it, drops the results and keeps focus", async () => {
    const { input, onchange, onclear } = submit({ value: "dune" });
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onchange).toHaveBeenCalledWith("");
    expect(onclear).toHaveBeenCalledOnce();
    expect(input).toHaveFocus();
  });

  it("Escape empties it and drops the results", async () => {
    const { input, onchange, onclear } = submit({ value: "dune" });
    input.focus();
    await userEvent.keyboard("{Escape}");
    expect(onchange).toHaveBeenCalledWith("");
    expect(onclear).toHaveBeenCalledOnce();
  });

  it("shows the spinner only while loading, never on its own", async () => {
    const { view, input } = submit({ value: "dune" });
    input.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.queryByRole("status", { name: "Searching" })).toBeNull();
    await view.rerender({ loading: true });
    expect(screen.getByRole("status", { name: "Searching" })).toBeInTheDocument();
    expect(screen.getByRole("search")).toHaveAttribute("aria-busy", "true");
  });
});
