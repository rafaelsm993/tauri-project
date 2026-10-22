import { describe, expect, it } from "vitest";
import { KeysStore } from "./keys.svelte";
import type { KeyPresence, Keyed, KeysClient } from "$lib/api/keys";

function fake(
  overrides: Partial<KeysClient> = {},
  start: KeyPresence = { tmdb: false, rawg: false },
) {
  let presence = { ...start };
  const calls: string[] = [];
  const client: KeysClient = {
    status: async () => presence,
    set: async (which: Keyed, key: string) => {
      calls.push(`set:${which}:${key}`);
      presence = { ...presence, [which]: key.trim().length > 0 };
      return presence;
    },
    clear: async (which: Keyed) => {
      calls.push(`clear:${which}`);
      presence = { ...presence, [which]: false };
      return presence;
    },
    check: async () => {},
    ...overrides,
  };
  return { client, calls };
}

describe("KeysStore", () => {
  it("starts with nothing set and loads the real presence", async () => {
    const { client } = fake({}, { tmdb: true, rawg: false });
    const store = new KeysStore(client);
    expect(store.presence).toEqual({ tmdb: false, rawg: false });

    await store.hydrate();
    expect(store.presence).toEqual({ tmdb: true, rawg: false });
    expect(store.ready).toBe(true);
  });

  it("checks a key before saving it, and saves it when the provider accepts", async () => {
    const order: string[] = [];
    const { client } = fake({
      check: async () => {
        order.push("check");
      },
      set: async (which, key) => {
        order.push("set");
        return { tmdb: which === "tmdb" && !!key, rawg: false };
      },
    });
    const store = new KeysStore(client);

    const ok = await store.save("tmdb", "good-key");
    expect(ok).toBe(true);
    expect(order).toEqual(["check", "set"]);
    expect(store.presence.tmdb).toBe(true);
    expect(store.errorFor("tmdb")).toBe("");
  });

  it("does not save a key the provider refused", async () => {
    const { client, calls } = fake({
      check: async () => {
        throw "That key was refused. Check it and try again.";
      },
    });
    const store = new KeysStore(client);

    const ok = await store.save("rawg", "bad-key");
    expect(ok).toBe(false);
    expect(calls.some((c) => c.startsWith("set:"))).toBe(false);
    expect(store.errorFor("rawg")).toBe("That key was refused. Check it and try again.");
    expect(store.presence.rawg).toBe(false);
  });

  it("clears a key without asking the provider", async () => {
    const { client, calls } = fake({}, { tmdb: true, rawg: true });
    const store = new KeysStore(client);
    await store.hydrate();

    await store.forget("tmdb");
    expect(store.presence).toEqual({ tmdb: false, rawg: true });
    expect(calls).toEqual(["clear:tmdb"]);
  });

  it("reports a saving error without claiming the key is set", async () => {
    const { client } = fake({
      set: async () => {
        throw new Error("disk full");
      },
    });
    const store = new KeysStore(client);

    expect(await store.save("tmdb", "k")).toBe(false);
    expect(store.errorFor("tmdb")).toContain("disk full");
    expect(store.presence.tmdb).toBe(false);
  });

  it("keeps working when the keys file cannot be read", async () => {
    const { client } = fake({
      status: async () => {
        throw new Error("nope");
      },
    });
    const store = new KeysStore(client);
    await store.hydrate();

    expect(store.ready).toBe(true);
    expect(store.presence).toEqual({ tmdb: false, rawg: false });
  });

  it("an error on one provider does not mark the other", async () => {
    const { client } = fake({
      check: async (which) => {
        if (which === "tmdb") throw "refused";
      },
    });
    const store = new KeysStore(client);

    await store.save("tmdb", "bad");
    await store.save("rawg", "good");
    expect(store.errorFor("tmdb")).toBe("refused");
    expect(store.errorFor("rawg")).toBe("");
  });

  it("says which providers need a key", async () => {
    const { client } = fake({}, { tmdb: false, rawg: true });
    const store = new KeysStore(client);
    await store.hydrate();

    expect(store.needsKey("movie")).toBe(true);
    expect(store.needsKey("tv")).toBe(true);
    expect(store.needsKey("game")).toBe(false);
    expect(store.needsKey("book")).toBe(false);
    expect(store.needsKey("anime")).toBe(false);
    expect(store.needsKey("manga")).toBe(false);
  });

  it("is busy only while a save is in flight", async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const { client } = fake({ check: () => gate });
    const store = new KeysStore(client);

    const pending = store.save("tmdb", "k");
    expect(store.busy).toBe(true);
    release();
    await pending;
    expect(store.busy).toBe(false);
  });
});
