import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { BEATS, beatIndex } from "$lib/domain/welcome";
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
    expect(screen.getByText(/Your own tree reflects your library/)).toBeTruthy();
    const preview = screen.getByRole("img", { name: "garden example — preview only" });
    expect(preview.querySelector(".runic-map")).not.toBeNull();
    expect(preview.querySelector("[inert]")).not.toBeNull();
  });

  it("walks the five beats in order", async () => {
    const user = userEvent.setup();
    await mount();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/grow/i);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/key/i);
    await user.click(screen.getByRole("button", { name: /continue without keys/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/plan/i);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/pages and chapters/i);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/match it later/i);
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
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Plan it when you are ready/,
    );
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
    for (const beat of BEATS.map(beatIndex)) {
      const saved: PrefsPatch[] = [];
      const { done } = await mount({ welcome_beat: beat }, saved);
      const user = userEvent.setup();
      await user.click(screen.getAllByRole("button", { name: /skip/i })[0]);
      await waitFor(() => expect(done).toHaveBeenCalled());
      cleanup();
    }
  });

  it("finishing the last beat marks the welcome done", async () => {
    const user = userEvent.setup();
    const saved: PrefsPatch[] = [];
    const { done } = await mount({ welcome_beat: beatIndex("manual") }, saved);

    await user.click(screen.getByRole("button", { name: /start|finish|done/i }));
    await waitFor(() => expect(saved.some((p) => p.welcomed === true)).toBe(true));
    expect(done).toHaveBeenCalled();
  });

  it("skips old taste and never rewrites legacy selections", async () => {
    const saved: PrefsPatch[] = [];
    const { p } = await mount({ welcome_beat: 2, taste_families: ["game"] }, saved);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Plan it when you are ready",
    );
    expect(screen.queryByRole("button", { name: "Games" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(saved.some((p) => p.welcomed)).toBe(true));
    expect(saved.every((p) => !("taste_families" in p) && !("taste_genres" in p))).toBe(true);
    expect(p.prefs.taste_families).toEqual(["game"]);
  });

  it("the keys beat asks for no key and never blocks progress", async () => {
    const user = userEvent.setup();
    await mount({ welcome_beat: 1 });

    expect(screen.getByLabelText(/TMDB/i)).toBeTruthy();
    expect(screen.getByLabelText(/RAWG/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /continue without keys/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Plan it when you are ready/,
    );
  });
});

it.each([
  [false, false, "Continue without keys"],
  [true, false, "Continue without RAWG key"],
  [false, true, "Continue without TMDB key"],
  [true, true, "Continue"],
] as const)("keys CTA reflects saved providers %s/%s", async (tmdb, rawg, label) => {
  const p = prefs({ welcome_beat: 1 });
  const k = keys({ tmdb, rawg });
  await p.hydrate();
  await k.hydrate();
  render(WelcomeFlow, { prefs: p, keys: k, ondone: vi.fn() });
  expect(screen.getByRole("button", { name: label as string })).toBeEnabled();
});

it("updates the CTA while typing and saves before advancing", async () => {
  const user = userEvent.setup();
  const p = prefs({ welcome_beat: 1 });
  const check = vi.fn(async () => {});
  const set = vi.fn(async () => ({ tmdb: true, rawg: false }));
  const k = keys(undefined, { check, set });
  await p.hydrate();
  await k.hydrate();
  render(WelcomeFlow, { prefs: p, keys: k, ondone: vi.fn() });
  await user.type(screen.getByLabelText("TMDB key"), "TEST_ONLY_NOT_A_REAL_KEY");
  expect(screen.getByRole("button", { name: "Continue without RAWG key" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Continue without RAWG key" }));
  expect(check).toHaveBeenCalledWith("tmdb", "TEST_ONLY_NOT_A_REAL_KEY");
  expect(set).toHaveBeenCalledWith("tmdb", "TEST_ONLY_NOT_A_REAL_KEY");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Plan it when you are ready/);
});

it.each([
  [
    0,
    /Journey Tree grows across six media paths/,
    /equip earned avatars, titles and themes in Settings/,
  ],
  [3, /Log session records progress/, /Planning schedules time/],
  [4, /pages per hour/, /minutes per chapter/],
  [5, /Add manually/, /Find a match/],
] as const)("teaches current behavior at beat %s", async (index, a, b) => {
  await mount({ welcome_beat: index });
  expect(document.body).toHaveTextContent(a);
  expect(document.body).toHaveTextContent(b);
});

it.each([
  ["  ", "  ", "Continue without keys"],
  ["", "TEST_ONLY_RAWG", "Continue without TMDB key"],
  ["TEST_ONLY_TMDB", "TEST_ONLY_RAWG", "Continue"],
] as const)("draft labels and saves %s/%s", async (tmdb, rawg, label) => {
  const p = prefs({ welcome_beat: 1 });
  const presence = { tmdb: false, rawg: false };
  const check = vi.fn(async () => {}),
    set = vi.fn(async (which: keyof KeyPresence) => ({
      ...presence,
      [which]: (presence[which] = true),
    }));
  const k = keys(undefined, { check, set });
  await p.hydrate();
  await k.hydrate();
  render(WelcomeFlow, { prefs: p, keys: k, ondone: vi.fn() });
  const user = userEvent.setup();
  if (tmdb) await user.type(screen.getByLabelText("TMDB key"), tmdb);
  if (rawg) await user.type(screen.getByLabelText("RAWG key"), rawg);
  expect(screen.queryByText("Saved and working.")).toBeNull();
  await user.click(screen.getByRole("button", { name: label }));
  expect(check).toHaveBeenCalledTimes(Number(Boolean(tmdb.trim())) + Number(Boolean(rawg.trim())));
  expect(set).toHaveBeenCalledTimes(check.mock.calls.length);
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: label })).toBeEnabled();
  expect(screen.getByLabelText("TMDB key")).toHaveValue(tmdb.trim() ? "" : tmdb);
});
it.each(["check", "set"] as const)(
  "failed %s keeps draft and beat even with an old saved key",
  async (failure) => {
    const saved: PrefsPatch[] = [];
    const p = prefs({ welcome_beat: 1 }, saved);
    const k = keys(
      { tmdb: true, rawg: false },
      { [failure]: vi.fn().mockRejectedValue("Test validation failed") },
    );
    await p.hydrate();
    await k.hydrate();
    const done = vi.fn();
    render(WelcomeFlow, { prefs: p, keys: k, ondone: done });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("TMDB key"), "TEST_ONLY_REPLACEMENT");
    await user.click(screen.getByRole("button", { name: "Continue without RAWG key" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bring your own keys");
    expect(screen.getByLabelText("TMDB key")).toHaveValue("TEST_ONLY_REPLACEMENT");
    expect(screen.getByText("Test validation failed")).toBeVisible();
    expect(saved).toEqual([]);
    expect(done).not.toHaveBeenCalled();
  },
);
it("pending key check locks navigation and inputs until verified save", async () => {
  let resolve!: () => void;
  const check = vi.fn(() => new Promise<void>((r) => (resolve = r)));
  const set = vi.fn(async () => ({ tmdb: true, rawg: false }));
  const p = prefs({ welcome_beat: 1 }),
    k = keys(undefined, { check, set });
  await p.hydrate();
  await k.hydrate();
  render(WelcomeFlow, { prefs: p, keys: k, ondone: vi.fn() });
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("TMDB key"), "TEST_ONLY_PENDING");
  await user.click(screen.getByRole("button", { name: "Continue without RAWG key" }));
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  expect(screen.getByRole("button", { name: "Checking keys…" })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(screen.getByLabelText("TMDB key")).toBeDisabled();
  expect(screen.getByLabelText("RAWG key")).toBeDisabled();
  expect(set).not.toHaveBeenCalled();
  resolve();
  await waitFor(() =>
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Plan it when you are ready",
    ),
  );
  expect(set).toHaveBeenCalledTimes(1);
});
