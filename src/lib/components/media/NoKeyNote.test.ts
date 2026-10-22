import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import NoKeyNote from "./NoKeyNote.svelte";
import { KeysStore } from "$lib/stores/keys.svelte";
import type { KeyPresence, KeysClient } from "$lib/api/keys";

function store(presence: KeyPresence) {
  const client: KeysClient = {
    status: async () => presence,
    set: async () => presence,
    clear: async () => presence,
    check: async () => {},
  };
  return new KeysStore(client);
}

describe("NoKeyNote", () => {
  it("says nothing when the provider has its key", async () => {
    const s = store({ tmdb: true, rawg: false });
    await s.hydrate();
    const { container } = render(NoKeyNote, { props: { type: "movie", store: s } });
    expect(container.textContent?.trim()).toBe("");
  });

  it("says nothing for a type that needs no key", async () => {
    const s = store({ tmdb: false, rawg: false });
    await s.hydrate();
    const { container } = render(NoKeyNote, { props: { type: "book", store: s } });
    expect(container.textContent?.trim()).toBe("");
  });

  it("explains the missing key and points at settings", async () => {
    const s = store({ tmdb: false, rawg: false });
    await s.hydrate();
    render(NoKeyNote, { props: { type: "movie", store: s } });

    expect(screen.getByText(/needs a free TMDB key/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /settings/i });
    expect(link.getAttribute("href")).toContain("/settings");
  });

  it("names the provider that serves games", async () => {
    const s = store({ tmdb: true, rawg: false });
    await s.hydrate();
    render(NoKeyNote, { props: { type: "game", store: s } });
    expect(screen.getByText(/needs a free RAWG key/i)).toBeTruthy();
  });

  it("offers adding the item by hand instead", async () => {
    const s = store({ tmdb: false, rawg: false });
    await s.hydrate();
    render(NoKeyNote, { props: { type: "tv", store: s } });
    expect(screen.getByRole("button", { name: /add tv show manually/i })).toBeTruthy();
  });
});
