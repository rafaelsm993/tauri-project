import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
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
  it("shows animations as On by default and says what they cover", () => {
    render(SettingsView, { store: storeWith().store });
    expect(screen.getByRole("group", { name: "Animations" })).toBeInTheDocument();
    expect(screen.getByText(/system's reduce-motion setting always wins/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
  });

  it("turning it off saves the preference", async () => {
    const { store, update } = storeWith();
    render(SettingsView, { store });
    await userEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(update).toHaveBeenCalledWith({ motion: false });
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
