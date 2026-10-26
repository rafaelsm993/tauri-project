import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ThemeSection from "$lib/components/settings/ThemeSection.svelte";
import TitlesSection from "$lib/components/settings/TitlesSection.svelte";
import RewardSheet from "./RewardSheet.svelte";
import { entry } from "./fixtures.test-utils";

describe("RewardSheet", () => {
  it("has real Settings destinations for all three preview links", () => {
    render(ThemeSection, { currentLevel: null, currentEntries: null });
    render(TitlesSection, { currentLevel: null });
    expect(screen.getByRole("region", { name: "Theme" })).toHaveAttribute("id", "theme");
    expect(screen.getByRole("region", { name: "Titles" })).toHaveAttribute("id", "titles");
    expect(screen.getByRole("region", { name: "Profile artwork" })).toHaveAttribute(
      "id",
      "profile-artwork",
    );
  });
  it("previews artwork with current count and level requirements, without equipping", async () => {
    const entries = Array.from({ length: 5 }, (_, i) => entry(i));
    const { rerender } = render(RewardSheet, {
      kind: "art",
      rewardId: "movie:5",
      entries,
      currentLevel: 1,
      onclose: vi.fn(),
    });
    const dialog = screen.getByRole("dialog", { name: "Silver Screen tier 2" });
    expect(dialog).toHaveTextContent("5 / 5 completed");
    expect(dialog).toHaveTextContent("Requires level 3");
    expect(dialog).toHaveTextContent("Requirements not met");
    expect(screen.getByRole("img", { name: "Silver Screen artwork" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open artwork in Settings" })).toHaveAttribute(
      "href",
      "/settings#profile-artwork",
    );
    expect(screen.queryByRole("button", { name: /equip/i })).toBeNull();
    await rerender({
      kind: "art",
      rewardId: "movie:5",
      entries,
      currentLevel: 3,
      onclose: vi.fn(),
    });
    expect(dialog).toHaveTextContent("Available");
    await rerender({
      kind: "art",
      rewardId: "movie:5",
      entries: [],
      currentLevel: 3,
      onclose: vi.fn(),
    });
    expect(dialog).toHaveTextContent("0 / 5 completed");
    expect(dialog).toHaveTextContent("Requirements not met");
  });

  it.each([
    ["accent", "dusk", "Dusk", "Theme", "theme"],
    ["title", "Enthusiast", "Enthusiast", "titles", "titles"],
  ] as const)(
    "links a %s preview to its matching Settings section",
    (kind, rewardId, name, section, hash) => {
      render(RewardSheet, { kind, rewardId, entries: [], currentLevel: 1, onclose: vi.fn() });
      expect(screen.getByRole("dialog", { name })).toHaveTextContent("Requires level 8");
      expect(screen.getByRole("dialog", { name })).toHaveTextContent("Requirements not met");
      expect(screen.getByRole("link", { name: `Open ${section} in Settings` })).toHaveAttribute(
        "href",
        `/settings#${hash}`,
      );
    },
  );

  it("handles unknown ids and unavailable authority without inventing rewards", () => {
    render(RewardSheet, {
      kind: "art",
      rewardId: "movie:3",
      entries: [],
      currentLevel: null,
      onclose: vi.fn(),
    });
    expect(screen.getByRole("dialog", { name: "Reward unavailable" })).toHaveTextContent(
      "Reward unavailable",
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
