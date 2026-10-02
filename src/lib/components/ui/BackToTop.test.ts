import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import BackToTop from "./BackToTop.svelte";
import { motionStore } from "$lib/stores/motion.svelte";

const NAME = "Back to top";

function setViewport(height: number) {
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
}

async function scrollWindowTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  await fireEvent.scroll(window);
}

function mockReducedMotion(reduce: boolean) {
  vi.spyOn(motionStore, "reduced", "get").mockReturnValue(reduce);
}

describe("BackToTop", () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setViewport(800);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is hidden (and not focusable) before the user scrolls", () => {
    render(BackToTop);
    expect(screen.queryByRole("button", { name: NAME })).not.toBeInTheDocument();
  });

  it("stays hidden until the scroll passes one viewport height", async () => {
    render(BackToTop);
    await scrollWindowTo(799);
    expect(screen.queryByRole("button", { name: NAME })).not.toBeInTheDocument();
    await scrollWindowTo(801);
    expect(screen.getByRole("button", { name: NAME })).toHaveAttribute("type", "button");
  });

  it("hides again after scrolling back above the threshold", async () => {
    render(BackToTop);
    await scrollWindowTo(1600);
    expect(screen.getByRole("button", { name: NAME })).toBeInTheDocument();
    await scrollWindowTo(100);
    expect(screen.queryByRole("button", { name: NAME })).not.toBeInTheDocument();
  });

  it("honours a custom threshold", async () => {
    render(BackToTop, { threshold: 200 });
    await scrollWindowTo(250);
    expect(screen.getByRole("button", { name: NAME })).toBeInTheDocument();
  });

  it("scrolls the window to the top smoothly on click", async () => {
    render(BackToTop);
    await scrollWindowTo(2000);
    await userEvent.click(screen.getByRole("button", { name: NAME }));
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: "smooth" });
  });

  it("jumps instantly when the user prefers reduced motion", async () => {
    mockReducedMotion(true);
    render(BackToTop);
    await scrollWindowTo(2000);
    await userEvent.click(screen.getByRole("button", { name: NAME }));
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: "instant" });
  });

  it("removes its scroll listener on unmount", async () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(BackToTop);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
