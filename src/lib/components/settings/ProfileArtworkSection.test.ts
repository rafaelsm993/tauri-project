import type { ComponentProps } from "svelte";
import { exposeSettings } from "./fixtures.test-utils";
import { describe, expect, it, vi } from "vitest";
import { render as renderComponent, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ProfileArtworkSection from "./ProfileArtworkSection.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS, type PrefsPatch } from "$lib/types/prefs";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";

const entry: LibraryEntry = {
  key: "manual:movie:1",
  snapshot: {
    media_key: "manual:movie:1",
    provider: "manual",
    media_type: "movie",
    title: "A film",
    poster_path: null,
    poster_file: null,
    year: null,
  },
  user: {
    status: "completed",
    progress: 1,
    rating: null,
    review: null,
    plan: null,
    length: emptyLength(),
  },
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
};
function setup(selected = "default") {
  let saved = { ...DEFAULT_PREFS, profile_art: selected };
  const update = vi.fn(async (patch: PrefsPatch) => (saved = { ...saved, ...patch }));
  const prefs = new PrefsStore({ load: async () => saved, update });
  prefs.prefs = saved;
  prefs.ready = prefs.loaded = true;
  return { prefs, update };
}
describe("ProfileArtworkSection", () => {
  it("offers only earned avatar images and a Default glyph", async () => {
    const s = setup();
    const { container } = render(ProfileArtworkSection, {
      prefs: s.prefs,
      currentLevel: 1,
      entries: [entry],
    });
    const choices = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
    expect(choices).toHaveLength(2);
    expect(screen.getByRole("group", { name: "Avatar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Silver Screen tier 2" })).toBeNull();
    expect(screen.queryByText(/1 \/ 5 completed/)).toBeNull();
    expect(container.querySelector(".reward-picker.image-only")).not.toBeNull();
    for (const button of choices) expect(button.querySelector("svg")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Silver Screen tier 1" }));
    expect(s.update).toHaveBeenLastCalledWith({ profile_art: "movie:1" });
    await userEvent.click(screen.getByRole("button", { name: "Default avatar" }));
    expect(s.update).toHaveBeenLastCalledWith({ profile_art: "default" });
  });
  it("explains a saved unavailable choice and restores it without rewriting preferences", async () => {
    const s = setup("movie:1");
    const { rerender } = render(ProfileArtworkSection, {
      prefs: s.prefs,
      currentLevel: 1,
      entries: [],
    });
    expect(screen.getByText(/Saved choice: Silver Screen tier 1/)).toHaveTextContent(
      "Using Default",
    );
    expect(screen.getByRole("button", { name: "Default avatar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Silver Screen tier 1" })).toBeNull();
    await rerender({ prefs: s.prefs, currentLevel: 1, entries: [entry] });
    expect(screen.getByRole("button", { name: "Silver Screen tier 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(s.update).not.toHaveBeenCalled();
  });
  it("disables all saves after prefs failure and locked art after library or activity failure", async () => {
    const s = setup("movie:1");
    s.prefs.loaded = false;
    const { rerender } = render(ProfileArtworkSection, {
      prefs: s.prefs,
      currentLevel: 1,
      entries: [entry],
    });
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    s.prefs.loaded = true;
    await rerender({ prefs: s.prefs, currentLevel: null, entries: [entry] });
    expect(screen.queryByRole("button", { name: "Silver Screen tier 1" })).toBeNull();
    await rerender({ prefs: s.prefs, currentLevel: 50, entries: null });
    expect(screen.queryByRole("button", { name: "Silver Screen tier 1" })).toBeNull();
    expect(s.update).not.toHaveBeenCalled();
  });
  it("serializes pending saves and shows failed-save rollback", async () => {
    const s = setup();
    let fail!: (reason: Error) => void;
    s.update.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    render(ProfileArtworkSection, { prefs: s.prefs, currentLevel: 1, entries: [entry] });
    await userEvent.click(screen.getByRole("button", { name: "Silver Screen tier 1" }));
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    fail(new Error("Disk full"));
    expect(await screen.findByRole("status", { name: "Artwork save" })).toHaveTextContent(
      "Disk full",
    );
    expect(screen.getByRole("button", { name: "Default avatar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(s.prefs.prefs.profile_art).toBe("default");
    expect(s.update).toHaveBeenCalledTimes(1);
  });
});

function render(
  component: typeof ProfileArtworkSection,
  props: ComponentProps<typeof ProfileArtworkSection>,
) {
  const result = renderComponent(component, props);
  exposeSettings(result.container);
  return result;
}
