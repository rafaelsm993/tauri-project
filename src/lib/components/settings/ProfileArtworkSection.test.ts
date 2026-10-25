import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
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
  it("previews all thirty requirements and only equips a currently earned reward", async () => {
    const s = setup();
    render(ProfileArtworkSection, { prefs: s.prefs, currentLevel: 1, entries: [entry] });
    expect(screen.getAllByRole("button")).toHaveLength(31);
    expect(screen.getByRole("button", { name: "Silver Screen tier 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Silver Screen tier 2" })).toBeDisabled();
    expect(screen.getByText("1 / 5 completed")).toBeInTheDocument();
    expect(screen.getAllByText("Requires level 3")).toHaveLength(6);
    await userEvent.click(screen.getByRole("button", { name: "Silver Screen tier 1" }));
    expect(s.update).toHaveBeenCalledWith({ profile_art: "movie:1" });
    expect(screen.getByRole("button", { name: "Silver Screen tier 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Default artwork" }));
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
    expect(screen.getByRole("button", { name: "Default artwork" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Silver Screen tier 1" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
    expect(screen.getByRole("button", { name: "Silver Screen tier 1" })).toBeDisabled();
    await rerender({ prefs: s.prefs, currentLevel: 50, entries: null });
    expect(screen.getByRole("button", { name: "Silver Screen tier 1" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Default artwork" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(s.prefs.prefs.profile_art).toBe("default");
    expect(s.update).toHaveBeenCalledTimes(1);
  });
});
