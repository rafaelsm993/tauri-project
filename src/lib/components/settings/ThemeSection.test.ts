import type { ComponentProps } from "svelte";
import { exposeSettings } from "./fixtures.test-utils";
import { describe, expect, it, vi } from "vitest";
import { render as renderComponent, waitFor, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ThemeSection from "./ThemeSection.svelte";
import { UNLOCKS } from "$lib/domain/unlocks";
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

describe("ThemeSection", () => {
  it.each(UNLOCKS)(
    "enforces $id's current boundary and restores its retained selection",
    async (reward) => {
      const { prefs, update } = setup({ theme: "dark", seen_level: 50 });
      const { rerender } = render(ThemeSection, { prefs, currentLevel: reward.level - 1 });
      const button = screen.getByRole("button", { name: reward.label });
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(update).not.toHaveBeenCalled();
      await rerender({ prefs, currentLevel: reward.level });
      expect(button).toBeEnabled();
      await userEvent.click(button);
      expect(update).toHaveBeenCalledWith({ [reward.kind]: reward.id });
      expect(button).toHaveAttribute("aria-pressed", "true");
      await rerender({ prefs, currentLevel: reward.level - 1 });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(prefs.prefs[reward.kind]).toBe(reward.id);
      await rerender({ prefs, currentLevel: reward.level });
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(update).toHaveBeenCalledTimes(1);
    },
  );

  it("never enables controls after a failed prefs hydration", () => {
    const { prefs, update } = setup({ accent: "ocean" });
    prefs.loaded = false;
    render(ThemeSection, { prefs, currentLevel: 50 });
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });

  it("never saves an animation choice while motion is off", async () => {
    const { prefs, update } = setup({ motion: false });
    render(ThemeSection, { prefs, currentLevel: 25 });
    for (const label of ["Background", "Tree effect"]) {
      for (const button of within(screen.getByRole("group", { name: label }))
        .getAllByRole("button")
        .filter((button) => button.hasAttribute("aria-pressed"))) {
        expect(button).toBeDisabled();
        await userEvent.click(button);
      }
    }
    expect(screen.getByRole("button", { name: "Midnight" })).toBeEnabled();
    expect(update).not.toHaveBeenCalled();
  });

  it("reports the next level and the end of the existing reward ladder", async () => {
    const { prefs } = setup();
    const { rerender } = render(ThemeSection, { prefs, currentLevel: 1 });
    expect(screen.getByText(/^Next at level 2:/)).toHaveTextContent("Bubbles");
    await rerender({ prefs, currentLevel: 25 });
    expect(screen.getByText(/every level reward is unlocked/i)).toBeInTheDocument();
  });

  it("serializes equipment saves and surfaces rollback errors", async () => {
    const { prefs, update } = setup({ accent: "ember" });
    let reject!: (reason: unknown) => void;
    update.mockImplementationOnce(
      () =>
        new Promise<Prefs>((_, no) => {
          reject = no;
        }),
    );
    render(ThemeSection, { prefs, currentLevel: 25 });
    await userEvent.click(screen.getByRole("button", { name: "Dusk" }));
    expect(screen.getByRole("button", { name: "Ocean" })).toBeDisabled();
    reject("disk full");
    expect(await screen.findByText(/could not save.*disk full/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ember" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ocean" })).toBeEnabled());
  });
  it("explains a retained unavailable choice without repairing it", async () => {
    const { prefs, update } = setup({ accent: "ember" });
    const { rerender } = render(ThemeSection, { prefs, currentLevel: 1 });
    expect(screen.getByText(/saved choice: ember.*using default/i)).toBeInTheDocument();
    await rerender({ prefs, currentLevel: 3 });
    expect(screen.getByRole("button", { name: "Ember" })).toHaveAttribute("aria-pressed", "true");
    expect(prefs.prefs.accent).toBe("ember");
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps incompatible palettes visible with their own reason", () => {
    const { prefs } = setup({ theme: "light" });
    render(ThemeSection, { prefs, currentLevel: 25 });
    expect(screen.getByRole("button", { name: "Midnight" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Midnight" })).toHaveAccessibleDescription(
      /dark theme/i,
    );
  });

  it("keeps earned animation previews distinct from level locks while paused", () => {
    const { prefs } = setup({ motion: false });
    render(ThemeSection, { prefs, currentLevel: 25 });
    expect(screen.getByRole("button", { name: "Bubbles" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bubbles" })).toHaveAccessibleDescription(
      /available.*animations are off/i,
    );
    expect(screen.getByRole("button", { name: "Ember" })).toBeEnabled();
    expect(screen.getAllByText(/only on the desktop app/i)).toHaveLength(1);
    expect(screen.getByText(/no continuous animation/i)).toBeInTheDocument();
  });
  it("equips an earned accent, marks it filled and permits clearing", async () => {
    const { prefs, update } = setup();
    render(ThemeSection, { prefs, currentLevel: 3 });
    const ember = screen.getByRole("button", { name: "Ember" });
    await userEvent.click(ember);
    expect(update).toHaveBeenCalledWith({ accent: "ember" });
    expect(ember).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      within(screen.getByRole("group", { name: "Accent" })).getByRole("button", {
        name: "Default",
      }),
    );
    expect(update).toHaveBeenLastCalledWith({ accent: "default" });
    expect(ember).toHaveAttribute("aria-pressed", "false");
  });
  it("keeps every slot accessible with Default and visible locked previews", () => {
    const { prefs, update } = setup({ seen_level: 25 });
    render(ThemeSection, { prefs, currentLevel: 1 });
    for (const label of ["Accent", "Palette", "Background", "Tree effect"]) {
      expect(
        within(screen.getByRole("group", { name: label })).getByRole("button", { name: "Default" }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    expect(screen.getByRole("button", { name: "Ocean" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAccessibleDescription(/level 20/i);
    expect(
      screen.getByRole("button", { name: "Ocean" }).querySelector('[aria-label="Ocean preview"]'),
    ).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});

function render(component: typeof ThemeSection, props: ComponentProps<typeof ThemeSection>) {
  const result = renderComponent(component, props);
  exposeSettings(result.container);
  return result;
}
