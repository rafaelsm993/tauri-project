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
  store.loaded = true;
  return { store, update };
}

describe("SettingsView", () => {
  it("hosts one Theme and Animations control with shared equipment and title preferences", async () => {
    const { store, update } = storeWith();
    render(SettingsView, { store, currentLevel: 3 });
    expect(screen.getAllByRole("heading", { name: "Theme" })).toHaveLength(1);
    expect(screen.getAllByRole("switch", { name: "Animations" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Ember" }));
    expect(update).toHaveBeenCalledWith({ accent: "ember" });
    await userEvent.click(screen.getByRole("button", { name: "Curious Mind" }));
    expect(update).toHaveBeenCalledWith({ title: "Curious Mind" });
    expect(screen.getByRole("button", { name: "Dusk" })).toBeDisabled();
  });
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

  describe("reading pace", () => {
    const pace = () => screen.getByLabelText("Pages per hour (books)");
    const chapter = () => screen.getByLabelText("Minutes per chapter (manga)");

    it("shows both, empty until set, and saves each on its own", async () => {
      const { store, update } = storeWith();
      render(SettingsView, { store });
      expect(pace()).toHaveValue(null);
      expect(chapter()).toHaveValue(null);
      await userEvent.type(pace(), "40");
      await userEvent.tab();
      expect(update).toHaveBeenCalledWith({ reading_pages_per_hour: 40 });
      await userEvent.type(chapter(), "6");
      await userEvent.tab();
      expect(update).toHaveBeenCalledWith({ manga_chapter_minutes: 6 });
      expect(update).toHaveBeenCalledTimes(2);
    });

    it("shows what is saved, and an emptied field clears it", async () => {
      const { store, update } = storeWith();
      store.prefs = { ...store.prefs, reading_pages_per_hour: 30, manga_chapter_minutes: 6 };
      render(SettingsView, { store });
      expect(pace()).toHaveValue(30);
      expect(chapter()).toHaveValue(6);
      await userEvent.clear(chapter());
      await userEvent.tab();
      expect(update).toHaveBeenCalledWith({ manga_chapter_minutes: null });
    });

    it("refuses a number out of range or not whole, says why, and saves nothing", async () => {
      const { store, update } = storeWith();
      render(SettingsView, { store });
      await userEvent.type(pace(), "999");
      await userEvent.tab();
      expect(screen.getByText("Use 5-300.")).toBeInTheDocument();
      await userEvent.type(chapter(), "0");
      await userEvent.tab();
      expect(screen.getByText("Use 1-120.")).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
      await userEvent.clear(pace());
      await userEvent.type(pace(), "45");
      await userEvent.tab();
      expect(screen.queryByText("Use 5-300.")).not.toBeInTheDocument();
      expect(update).toHaveBeenCalledWith({ reading_pages_per_hour: 45 });
    });

    it("waits for the saved prefs before it can be edited", () => {
      const { store } = storeWith();
      store.ready = false;
      render(SettingsView, { store });
      expect(pace()).toBeDisabled();
      expect(chapter()).toBeDisabled();
    });
  });
});
