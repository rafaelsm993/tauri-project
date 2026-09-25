import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SettingsView from "./SettingsView.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import type { Prefs, PrefsPatch } from "$lib/types/prefs";

function storeWith(
  update: (patch: PrefsPatch) => Promise<Prefs> = vi.fn(async (patch: PrefsPatch) => ({
    background_animation: true,
    ...patch,
  })),
) {
  const store = new PrefsStore({
    load: vi.fn(async () => ({ background_animation: true })),
    update,
  });
  store.ready = true;
  return { store, update };
}

describe("SettingsView", () => {
  it("shows the animated background as On by default", () => {
    render(SettingsView, { store: storeWith().store });
    expect(screen.getByRole("group", { name: "Animated background" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
  });

  it("turning it off saves the preference", async () => {
    const { store, update } = storeWith();
    render(SettingsView, { store });
    await userEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(update).toHaveBeenCalledWith({ background_animation: false });
    expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the toggle disabled until the saved prefs load", () => {
    const { store } = storeWith();
    store.ready = false;
    render(SettingsView, { store });
    expect(screen.getByRole("button", { name: "On" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Off" })).toBeDisabled();
  });

  it("shows the error when saving fails", async () => {
    const { store } = storeWith(vi.fn(async () => Promise.reject<Prefs>("read-only disk")));
    render(SettingsView, { store });
    await userEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("read-only disk");
    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
  });
});
