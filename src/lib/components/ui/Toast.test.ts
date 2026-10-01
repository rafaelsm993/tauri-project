import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import Toast from "./Toast.svelte";

afterEach(() => vi.useRealTimers());

const text = (html: string) => createRawSnippet(() => ({ render: () => html }));

function setup(props: Partial<{ open: boolean; autoHideMs: number; resetKey: unknown }> = {}) {
  const onclose = vi.fn();
  const view = render(Toast, {
    open: true,
    label: "Reminder",
    onclose,
    children: text("<p>Hello</p>"),
    actions: text("<button type='button'>Start</button>"),
    ...props,
  });
  return { onclose, ...view };
}

describe("Toast", () => {
  it("keeps a named, polite live region even when closed", () => {
    setup({ open: false });
    const region = screen.getByRole("status", { name: "Reminder" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("shows its content, actions and Close when open", async () => {
    const { onclose } = setup();
    expect(screen.getByRole("status")).toHaveTextContent("Hello");
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("names its Close button when asked", () => {
    const onclose = vi.fn();
    render(Toast, {
      open: true,
      label: "Reminder",
      closeLabel: "Close reminder",
      onclose,
      children: text("<p>Hi</p>"),
    });
    expect(screen.getByRole("button", { name: "Close reminder" })).toBeInTheDocument();
  });

  it("hides by itself only when given a time", () => {
    vi.useFakeTimers();
    const { onclose } = setup();
    vi.advanceTimersByTime(60_000);
    expect(onclose).not.toHaveBeenCalled();
  });

  it("restarts its time when the content key changes", async () => {
    vi.useFakeTimers();
    const { onclose, rerender } = setup({ autoHideMs: 1_000, resetKey: 1 });
    vi.advanceTimersByTime(800);
    await rerender({ resetKey: 2 });
    vi.advanceTimersByTime(999);
    expect(onclose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onclose).toHaveBeenCalledOnce();
  });
});
