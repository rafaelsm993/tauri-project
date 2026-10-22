import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import KeysSection from "./KeysSection.svelte";
import { KeysStore } from "$lib/stores/keys.svelte";
import type { KeyPresence, KeysClient } from "$lib/api/keys";

// An external link must leave the webview; the app must never navigate itself away.
const opened: string[] = [];
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: async (url: string) => {
    opened.push(url);
  },
}));

beforeEach(() => {
  opened.length = 0;
});

function store(
  presence: KeyPresence = { tmdb: false, rawg: false },
  over: Partial<KeysClient> = {},
) {
  const client: KeysClient = {
    status: async () => presence,
    set: async (which, key) => ({ ...presence, [which]: key.length > 0 }),
    clear: async (which) => ({ ...presence, [which]: false }),
    check: async () => {},
    ...over,
  };
  return new KeysStore(client);
}

describe("KeysSection", () => {
  it("offers a field per provider and never shows a saved key", async () => {
    const s = store({ tmdb: true, rawg: false });
    await s.hydrate();
    render(KeysSection, { props: { store: s } });

    expect(screen.getByLabelText(/TMDB/i)).toBeTruthy();
    expect(screen.getByLabelText(/RAWG/i)).toBeTruthy();
    // A set key shows as a state, not a value.
    const tmdb = screen.getByLabelText(/TMDB/i) as HTMLInputElement;
    expect(tmdb.value).toBe("");
    expect(screen.getByText(/saved/i)).toBeTruthy();
  });

  it("saves a pasted key and then reports it as saved", async () => {
    const user = userEvent.setup();
    const check = vi.fn(async () => {});
    const s = store({ tmdb: false, rawg: false }, { check });
    await s.hydrate();
    render(KeysSection, { props: { store: s } });

    await user.type(screen.getByLabelText(/TMDB/i), "my-key");
    await user.click(screen.getByRole("button", { name: /save tmdb key/i }));

    await waitFor(() => expect(check).toHaveBeenCalledWith("tmdb", "my-key"));
    await waitFor(() => expect(s.presence.tmdb).toBe(true));
  });

  it("shows why a key was refused and keeps the field", async () => {
    const user = userEvent.setup();
    const s = store(
      { tmdb: false, rawg: false },
      {
        check: async () => {
          throw "That key was refused. Check it and try again.";
        },
      },
    );
    await s.hydrate();
    render(KeysSection, { props: { store: s } });

    await user.type(screen.getByLabelText(/RAWG/i), "bad");
    await user.click(screen.getByRole("button", { name: /save rawg key/i }));

    await waitFor(() => expect(screen.getByText(/refused/i)).toBeTruthy());
    expect(s.presence.rawg).toBe(false);
  });

  it("removes a saved key", async () => {
    const user = userEvent.setup();
    const clear = vi.fn(async () => ({ tmdb: false, rawg: false }) as KeyPresence);
    const s = store({ tmdb: true, rawg: false }, { clear });
    await s.hydrate();
    render(KeysSection, { props: { store: s } });

    await user.click(screen.getByRole("button", { name: /remove tmdb key/i }));
    await waitFor(() => expect(clear).toHaveBeenCalledWith("tmdb"));
  });

  it("offers no remove button for a key that is not set", async () => {
    const s = store({ tmdb: false, rawg: false });
    await s.hydrate();
    render(KeysSection, { props: { store: s } });

    expect(screen.queryByRole("button", { name: /remove tmdb key/i })).toBeNull();
  });

  it("opens the provider's key page in the system browser, not in the app", async () => {
    const user = userEvent.setup();
    const s = store();
    await s.hydrate();
    render(KeysSection, { props: { store: s } });

    await user.click(screen.getByRole("button", { name: /how to get a tmdb key/i }));
    expect(opened).toEqual(["https://www.themoviedb.org/settings/api"]);

    await user.click(screen.getByRole("button", { name: /how to get a rawg key/i }));
    expect(opened).toEqual(["https://www.themoviedb.org/settings/api", "https://rawg.io/apidocs"]);
  });
});
