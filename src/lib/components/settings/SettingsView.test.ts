import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SettingsView from "./SettingsView.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { DEFAULT_PREFS, type Prefs, type PrefsPatch } from "$lib/types/prefs";

function storeWith(
  update: (patch: PrefsPatch) => Promise<Prefs> = vi.fn(async (patch: PrefsPatch) => ({
    ...DEFAULT_PREFS,
    ...patch,
  })),
) {
  const store = new PrefsStore({
    load: vi.fn(async () => ({ ...DEFAULT_PREFS })),
    update,
  });
  store.ready = true;
  return { store, update };
}

describe("SettingsView", () => {
  const animations = () => screen.getByRole("switch", { name: "Animations" });
  const theme = () => screen.getByRole("group", { name: "Theme" });

  it("shows animations as a switch, on by default, and says what they cover", () => {
    render(SettingsView, { store: storeWith().store });
    expect(animations()).toHaveAttribute("aria-checked", "true");
    expect(animations()).toHaveAccessibleDescription(/system's reduce-motion setting always wins/i);
  });

  it("turning it off saves the preference", async () => {
    const { store, update } = storeWith();
    render(SettingsView, { store });
    await userEvent.click(animations());
    expect(update).toHaveBeenCalledWith({ motion: false });
    expect(animations()).toHaveAttribute("aria-checked", "false");
  });

  it("keeps the controls disabled until the saved prefs load", () => {
    const { store } = storeWith();
    store.ready = false;
    render(SettingsView, { store });
    expect(animations()).toBeDisabled();
    expect(within(theme()).getByRole("button", { name: "Light" })).toBeDisabled();
  });

  it("offers System, Dark and Light, following the system by default", () => {
    render(SettingsView, { store: storeWith().store });
    const options = within(theme()).getAllByRole("button");
    expect(options.map((b) => b.textContent?.trim())).toEqual(["System", "Dark", "Light"]);
    expect(within(theme()).getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("picking a theme saves it", async () => {
    const { store, update } = storeWith();
    render(SettingsView, { store });
    await userEvent.click(within(theme()).getByRole("button", { name: "Light" }));
    expect(update).toHaveBeenCalledWith({ theme: "light" });
    expect(within(theme()).getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows the error when saving fails", async () => {
    const { store } = storeWith(vi.fn(async () => Promise.reject<Prefs>("read-only disk")));
    render(SettingsView, { store });
    await userEvent.click(animations());
    expect(await screen.findByRole("alert")).toHaveTextContent("read-only disk");
    expect(animations()).toHaveAttribute("aria-checked", "true");
  });
});
