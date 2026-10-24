import { describe, expect, it } from "vitest";
import { createRawSnippet, tick } from "svelte";
import { render, screen } from "@testing-library/svelte";
import AppHeader from "./AppHeader.svelte";

// A small stand-in for the real store: the header only asks "is there a level?"
const gamification = (ready = true) => ({
  ready,
  level: { level: 3, xp: 141, into: 40, needed: 100, fraction: 0.4 },
  title: { name: "Newcomer" },
});

const base = { gamification: gamification() };

const snippet = (html: string) => createRawSnippet(() => ({ render: () => html }));

function scrollTo(y: number) {
  window.scrollY = y;
  window.dispatchEvent(new Event("scroll"));
}

describe("AppHeader", () => {
  it("starts expanded", () => {
    const { container } = render(AppHeader, { ...base });
    expect(container.querySelector(".app-header")).toHaveAttribute("data-collapsed", "false");
  });

  it("collapses when the page scrolls down", async () => {
    const { container } = render(AppHeader, { ...base });
    scrollTo(300);
    await tick();
    expect(container.querySelector(".app-header")).toHaveAttribute("data-collapsed", "true");
  });

  it("comes back on an upward scroll", async () => {
    const { container } = render(AppHeader, { ...base });
    scrollTo(300);
    await tick();
    scrollTo(100);
    await tick();
    expect(container.querySelector(".app-header")).toHaveAttribute("data-collapsed", "false");
  });

  it("carries the level chip, which the phone otherwise never shows", () => {
    render(AppHeader, { ...base });
    expect(screen.getByRole("link", { name: /Level 3/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/profile"),
    );
  });

  it("shows no chip before the level is known, so onboarding can use it", () => {
    render(AppHeader, { ...base, gamification: gamification(false) });
    expect(screen.queryByRole("link", { name: /Level/ })).not.toBeInTheDocument();
  });

  it("gives the page one heading, so every screen titles itself the same way", () => {
    render(AppHeader, { ...base, heading: "Library" });
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
  });

  it("renders no heading for a search-first page like Home", () => {
    // Home has no <h1> today; a blank title row would only cost vertical space.
    render(AppHeader, { ...base });
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("puts a page action in the title row", () => {
    render(AppHeader, {
      ...base,
      heading: "Library",
      action: snippet("<button>Add manually</button>"),
    });
    expect(screen.getByRole("button", { name: "Add manually" })).toBeInTheDocument();
  });

  it("keeps the persistent row on screen and lets the collapsible one go", async () => {
    const { container } = render(AppHeader, {
      ...base,
      persistent: snippet('<input aria-label="Search" />'),
      collapsible: snippet("<button>Movies</button>"),
    });
    scrollTo(300);
    await tick();
    // Both still exist; only the wrapper's collapsed state changes, so search stays reachable.
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(container.querySelector(".collapsible")).toBeInTheDocument();
    expect(container.querySelector(".app-header")).toHaveAttribute("data-collapsed", "true");
  });

  it("stops listening once it is gone", async () => {
    const { unmount } = render(AppHeader, { ...base });
    unmount();
    // A state write after teardown would throw; the scroll must be a no-op.
    expect(() => scrollTo(900)).not.toThrow();
  });
});
