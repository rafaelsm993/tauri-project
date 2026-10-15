import { afterEach, describe, expect, it, vi } from "vitest";
import { createRawSnippet } from "svelte";
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { pushState } from "$app/navigation";
import { page } from "$app/state";
import Sheet from "./Sheet.svelte";

const fields = createRawSnippet(() => ({
  render: () =>
    `<div><p>Pick a length</p><input aria-label="Minutes" /><button>Save</button></div>`,
}));

function open(onclose = vi.fn()) {
  const view = render(Sheet, { label: "Add Dune", onclose, children: fields });
  return { onclose, view, dialog: screen.getByRole("dialog", { name: "Add Dune" }) };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(pushState).mockClear();
});

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

  it("owns a history entry while open, so Back closes it first", () => {
    open();
    expect(pushState).toHaveBeenCalledWith("", { sheet: "Add Dune" });
  });

  it("asks to close when Back pops its history entry", () => {
    const { onclose } = open();
    page.state = {};
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("ignores a popstate that leaves its entry in place", () => {
    const { onclose } = open();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onclose).not.toHaveBeenCalled();
  });

  it("drops its history entry when closed another way", () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const { view } = open();
    view.unmount();
    expect(back).toHaveBeenCalledOnce();
  });

  it("leaves history alone when Back already closed it", () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const { view } = open();
    page.state = {};
    window.dispatchEvent(new PopStateEvent("popstate"));
    view.unmount();
    expect(back).not.toHaveBeenCalled();
  });

  it("asks to close after a long swipe down on the handle, not a short one", async () => {
    const { onclose, dialog } = open();
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({ height: 400 } as DOMRect);
    const handle = dialog.querySelector<HTMLElement>(".sheet-handle")!;
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = () => true;
    const swipe = async (dy: number) => {
      await fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 });
      await fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 + dy });
      await fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 + dy });
    };
    await swipe(60);
    expect(onclose).not.toHaveBeenCalled();
    await swipe(150);
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("keeps a focused field in view above the keyboard", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    open();
    screen.getByRole("button", { name: "Save" }).focus();
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
  });
});
