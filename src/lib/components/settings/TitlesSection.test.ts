import type { ComponentProps } from "svelte";
import { exposeSettings } from "./fixtures.test-utils";
import { describe, expect, it, vi } from "vitest";
import { render as renderComponent, waitFor, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import TitlesSection from "./TitlesSection.svelte";
import { TITLES } from "$lib/domain/gamification";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS, type Prefs, type PrefsPatch } from "$lib/types/prefs";

function setup(overrides: Partial<Prefs> = {}) {
  let saved = { ...DEFAULT_PREFS, ...overrides };
  const update = vi.fn(async (patch: PrefsPatch) => (saved = { ...saved, ...patch }));
  const prefs = new PrefsStore({ load: async () => saved, update });
  prefs.prefs = saved;
  prefs.ready = prefs.loaded = true;
  return { prefs, update };
}

describe("TitlesSection", () => {
  it.each(TITLES)("enforces $name's boundary without historical entitlement", async (title) => {
    const { prefs, update } = setup({ seen_level: 99 });
    const { rerender } = render(TitlesSection, { prefs, currentLevel: title.level - 1 });
    const button = screen.getByRole("button", { name: title.name });
    expect(button).toBeDisabled();
    await rerender({ prefs, currentLevel: title.level });
    await userEvent.click(button);
    expect(update).toHaveBeenCalledWith({ title: title.name });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await rerender({ prefs, currentLevel: title.level - 1 });
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Automatic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(prefs.prefs.title).toBe(title.name);
    expect(update).toHaveBeenCalledTimes(1);
  });
  it.each(["unknown future title", "Curious Mind"])(
    "keeps unavailable %s without a repair write",
    (title) => {
      const { prefs, update } = setup({ title });
      render(TitlesSection, { prefs, currentLevel: 1 });
      expect(screen.getByRole("button", { name: "Automatic" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(prefs.prefs.title).toBe(title);
      expect(update).not.toHaveBeenCalled();
    },
  );
  it("disables every choice without successful prefs hydration", () => {
    const { prefs, update } = setup();
    prefs.loaded = false;
    render(TitlesSection, { prefs, currentLevel: 50 });
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });

  it("preserves an unavailable stored choice and restores it when re-earned", async () => {
    const { prefs, update } = setup({ title: "Curious Mind" });
    const { rerender } = render(TitlesSection, { prefs, currentLevel: 1 });
    expect(screen.getByText(/saved choice: curious mind/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Automatic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await rerender({ prefs, currentLevel: 3 });
    expect(screen.getByRole("button", { name: "Curious Mind" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("serializes selection while saving and rolls back on failure", async () => {
    const { prefs, update } = setup({ title: "Newcomer" });
    let reject!: (reason: unknown) => void;
    update.mockImplementationOnce(
      () =>
        new Promise<Prefs>((_, no) => {
          reject = no;
        }),
    );
    render(TitlesSection, { prefs, currentLevel: 8 });
    await userEvent.click(screen.getByRole("button", { name: "Curious Mind" }));
    expect(screen.getByRole("button", { name: "Automatic" })).toBeDisabled();
    reject("read-only disk");
    expect(await screen.findByText(/could not save.*read-only disk/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Newcomer" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Automatic" })).toBeEnabled());
  });
  it("offers Automatic, earned titles and locked titles with their level", async () => {
    const { prefs, update } = setup({ seen_level: 50 });
    render(TitlesSection, { prefs, currentLevel: 8 });
    expect(screen.getByRole("button", { name: "Automatic" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Connoisseur" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connoisseur" })).toHaveAccessibleDescription(
      /level 12/i,
    );
    await userEvent.click(screen.getByRole("button", { name: "Curious Mind" }));
    expect(update).toHaveBeenCalledWith({ title: "Curious Mind" });
    expect(screen.getByRole("button", { name: "Curious Mind" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Automatic" }));
    expect(update).toHaveBeenLastCalledWith({ title: "automatic" });
  });
});

function render(component: typeof TitlesSection, props: ComponentProps<typeof TitlesSection>) {
  const result = renderComponent(component, props);
  exposeSettings(result.container);
  return result;
}
