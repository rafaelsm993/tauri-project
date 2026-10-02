import { afterEach, describe, expect, it, vi } from "vitest";
import { createRawSnippet } from "svelte";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Sheet from "./Sheet.svelte";

const fields = createRawSnippet(() => ({
  render: () =>
    `<div><p>Pick a length</p><input aria-label="Minutes" /><button>Save</button></div>`,
}));

function open(onclose = vi.fn()) {
  const view = render(Sheet, { label: "Add Dune", onclose, children: fields });
  return { onclose, view, dialog: screen.getByRole("dialog", { name: "Add Dune" }) };
}

afterEach(() => vi.restoreAllMocks());

describe("Sheet", () => {
  it("is a labelled native dialog opened as a modal", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const { dialog } = open();
    expect(dialog.tagName).toBe("DIALOG");
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog).toHaveAttribute("open");
  });

  it("moves focus to the first field", () => {
    open();
    expect(screen.getByLabelText("Minutes")).toHaveFocus();
  });

  it("asks to close on Escape", async () => {
    const { onclose } = open();
    await userEvent.keyboard("{Escape}");
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("asks to close on the system back gesture and stays open until the parent closes it", () => {
    const { onclose, dialog } = open();
    const cancel = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(onclose).toHaveBeenCalledOnce();
    expect(cancel.defaultPrevented).toBe(true);
  });

  it("asks to close when the backdrop is clicked, not the content", async () => {
    const { onclose, dialog } = open();
    await userEvent.click(screen.getByText("Pick a length"));
    expect(onclose).not.toHaveBeenCalled();
    await userEvent.click(dialog);
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("gives focus back to what opened it", async () => {
    const opener = document.body.appendChild(document.createElement("button"));
    opener.focus();
    const { view } = open();
    expect(opener).not.toHaveFocus();
    view.unmount();
    await Promise.resolve();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("keeps clear of an on-screen keyboard", () => {
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 800);
    const { dialog } = open();
    const covered = () => dialog.style.getPropertyValue("--sheet-covered");
    expect(covered()).toBe("0px");
    viewport.height = 470;
    viewport.dispatchEvent(new Event("resize"));
    expect(covered()).toBe("330px");
    vi.unstubAllGlobals();
  });
});
