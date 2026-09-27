import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import LevelUpToast from "./LevelUpToast.svelte";
import type { Moment } from "$lib/domain/gamification";

afterEach(() => vi.useRealTimers());

function setup(moment: Moment | null) {
  const onclose = vi.fn();
  render(LevelUpToast, { moment, onclose });
  return { onclose };
}

describe("LevelUpToast", () => {
  it("announces the level and the new title politely", () => {
    setup({ level: 3, newTitle: "Curious Mind" });
    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveTextContent("Level 3");
    expect(toast).toHaveTextContent("New title: Curious Mind");
  });

  it("names only the level when the title did not change", () => {
    setup({ level: 4, newTitle: null });
    expect(screen.getByRole("status")).toHaveTextContent("Level 4");
    expect(screen.queryByText(/New title/)).not.toBeInTheDocument();
  });

  it("closes from its button", async () => {
    const { onclose } = setup({ level: 4, newTitle: null });
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("hides by itself after six seconds", () => {
    vi.useFakeTimers();
    const { onclose } = setup({ level: 4, newTitle: null });
    vi.advanceTimersByTime(5_999);
    expect(onclose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("keeps an empty live region when there is nothing to say", () => {
    setup(null);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
