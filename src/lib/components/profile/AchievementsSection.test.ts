import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import AchievementsSection from "./AchievementsSection.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { UnlocksStore } from "$lib/stores/unlocks.svelte";
import { DEFAULT_PREFS, type Prefs } from "$lib/types/prefs";

function stores(overrides: Partial<Prefs> = {}) {
  const next = { ...DEFAULT_PREFS, ...overrides };
  const update = vi.fn(async () => next);
  const prefs = new PrefsStore({ load: vi.fn(), update });
  prefs.prefs = next;
  prefs.ready = true;
  return { unlocks: new UnlocksStore(prefs), update };
}

describe("AchievementsSection", () => {
  it("promises the next reward while nothing is unlocked", () => {
    const { unlocks } = stores({ seen_level: 1 });
    render(AchievementsSection, { unlocks });
    const next = screen.getByText(/^Next at level 2:/);
    expect(next).toHaveTextContent("Bubbles");
  });

  it("shows a locked reward with the level it needs, not as a choice", () => {
    const { unlocks } = stores({ seen_level: 1 });
    render(AchievementsSection, { unlocks });
    expect(screen.queryByRole("button", { name: /^Ocean$/ })).not.toBeInTheDocument();
  });

  it("offers an unlocked accent as a real choice", async () => {
    const { unlocks, update } = stores({ seen_level: 3 });
    render(AchievementsSection, { unlocks });
    await userEvent.click(screen.getByRole("button", { name: /^Ember$/ }));
    expect(update).toHaveBeenCalledWith({ accent: "ember" });
  });

  it("marks the equipped choice as pressed, so selection is visible without a tick box", () => {
    const { unlocks } = stores({ seen_level: 3, accent: "ember" });
    render(AchievementsSection, { unlocks });
    expect(screen.getByRole("button", { name: /^Ember$/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("lets the user go back to the base palette", async () => {
    const { unlocks, update } = stores({ seen_level: 3, accent: "ember" });
    render(AchievementsSection, { unlocks });
    // Each slot has its own Default, so scope to the accent group.
    const accents = screen.getByRole("group", { name: "Accent" });
    await userEvent.click(within(accents).getByRole("button", { name: /^Default$/ }));
    expect(update).toHaveBeenCalledWith({ accent: "default" });
  });

  it("does not offer a dark-only pack while the light theme is on", () => {
    const { unlocks } = stores({ seen_level: 25, theme: "light" });
    render(AchievementsSection, { unlocks });
    expect(screen.queryByRole("button", { name: /^Midnight$/ })).not.toBeInTheDocument();
  });

  it("offers that pack under the dark theme", () => {
    const { unlocks } = stores({ seen_level: 25, theme: "dark" });
    render(AchievementsSection, { unlocks });
    expect(screen.getByRole("button", { name: /^Midnight$/ })).toBeInTheDocument();
  });

  it("says everything is open once the ladder is finished", () => {
    const { unlocks } = stores({ seen_level: 99 });
    render(AchievementsSection, { unlocks });
    expect(screen.getByText(/everything is unlocked/i)).toBeInTheDocument();
  });
});
