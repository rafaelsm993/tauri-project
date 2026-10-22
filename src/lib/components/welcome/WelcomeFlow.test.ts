import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import WelcomeFlow from "./WelcomeFlow.svelte";
import { PrefsStore } from "$lib/stores/prefs.svelte";
import { KeysStore } from "$lib/stores/keys.svelte";
import { DEFAULT_PREFS, type Prefs, type PrefsPatch } from "$lib/types/prefs";
import type { KeyPresence, KeysClient } from "$lib/api/keys";

function prefs(over: Partial<Prefs> = {}, saved: PrefsPatch[] = []) {
  let state: Prefs = { ...DEFAULT_PREFS, ...over };
  const store = new PrefsStore({
    load: async () => state,
    update: async (patch: PrefsPatch) => {
      saved.push(patch);
      state = { ...state, ...patch };
      return state;
    },
  });
  return store;
}

function keys(
  presence: KeyPresence = { tmdb: false, rawg: false },
  over: Partial<KeysClient> = {},
) {
  const client: KeysClient = {
    status: async () => presence,
    set: async () => presence,
    clear: async () => presence,
    check: async () => {},
    ...over,
  };
  return new KeysStore(client);
}

async function mount(over: Partial<Prefs> = {}, saved: PrefsPatch[] = []) {
  const p = prefs(over, saved);
  const k = keys();
  await p.hydrate();
  await k.hydrate();
  const done = vi.fn();
  render(WelcomeFlow, { props: { prefs: p, keys: k, ondone: done } });
  return { p, k, done };
}

describe("WelcomeFlow", () => {
  it("opens on the garden beat with an example, not the user's library", async () => {
    await mount();
    expect(screen.getByText(/an example/i)).toBeTruthy();
  });

  it("walks the four beats in order", async () => {
    const user = userEvent.setup();
    await mount();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/grow/i);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/key/i);
    await user.click(screen.getByRole("button", { name: /continue without keys/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/what do you/i);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/plan/i);
  });

  it("remembers the beat it is on, so quitting resumes there", async () => {
    const user = userEvent.setup();
    const saved: PrefsPatch[] = [];
    await mount({}, saved);

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(saved.some((p) => p.welcome_beat === 1)).toBe(true));
  });

  it("resumes where the user stopped", async () => {
    await mount({ welcome_beat: 2 });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/what do you/i);
  });

  it("can go back a beat", async () => {
    const user = userEvent.setup();
    await mount({ welcome_beat: 1 });

    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/grow/i);
  });

  it("offers no back button on the first beat", async () => {
    await mount();
    expect(screen.queryByRole("button", { name: /^back$/i })).toBeNull();
  });

  it("skipping marks the welcome done and leaves", async () => {
    const user = userEvent.setup();
    const saved: PrefsPatch[] = [];
    const { done } = await mount({}, saved);

    await user.click(screen.getByRole("button", { name: /skip/i }));
    await waitFor(() => expect(saved.some((p) => p.welcomed === true)).toBe(true));
    expect(done).toHaveBeenCalled();
  });

  it("can be skipped from every beat", async () => {
    for (const beat of [0, 1, 2, 3]) {
      const saved: PrefsPatch[] = [];
      const { done } = await mount({ welcome_beat: beat }, saved);
      const user = userEvent.setup();
      await user.click(screen.getAllByRole("button", { name: /skip/i })[0]);
      await waitFor(() => expect(done).toHaveBeenCalled());
      screen.getAllByRole("button").forEach(() => {});
      document.body.innerHTML = "";
    }
  });

  it("finishing the last beat marks the welcome done", async () => {
    const user = userEvent.setup();
    const saved: PrefsPatch[] = [];
    const { done } = await mount({ welcome_beat: 3 }, saved);

    await user.click(screen.getByRole("button", { name: /start|finish|done/i }));
    await waitFor(() => expect(saved.some((p) => p.welcomed === true)).toBe(true));
    expect(done).toHaveBeenCalled();
  });

  it("saves the families the user picked", async () => {
    const user = userEvent.setup();
    const saved: PrefsPatch[] = [];
    await mount({ welcome_beat: 2 }, saved);

    await user.click(screen.getByRole("button", { name: /books/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() =>
      expect(saved.some((p) => (p.taste_families ?? []).includes("book"))).toBe(true),
    );
  });

  it("a picked family can be unpicked", async () => {
    const user = userEvent.setup();
    const saved: PrefsPatch[] = [];
    await mount({ welcome_beat: 2 }, saved);

    const books = screen.getByRole("button", { name: /books/i });
    await user.click(books);
    expect(books.getAttribute("aria-pressed")).toBe("true");
    await user.click(books);
    expect(books.getAttribute("aria-pressed")).toBe("false");
  });

  it("the keys beat asks for no key and never blocks progress", async () => {
    const user = userEvent.setup();
    await mount({ welcome_beat: 1 });

    expect(screen.getByLabelText(/TMDB/i)).toBeTruthy();
    expect(screen.getByLabelText(/RAWG/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /continue without keys/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/what do you/i);
  });
});
