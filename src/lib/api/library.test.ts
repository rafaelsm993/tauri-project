import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { library } from "./library";
import type { MediaItem } from "$lib/types/media";

afterEach(() => {
  clearMocks();
  vi.useRealTimers();
});

const ITEM = { media_key: "tmdb:tv:7", media_type: "tv", title: "Arcane" } as unknown as MediaItem;

function record(reply: unknown = null) {
  const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args: args as Record<string, unknown> });
    return reply;
  });
  return calls;
}

describe("library client", () => {
  it("load sends one library_load call with no arguments", async () => {
    const calls = record([]);
    await library.load();
    expect(calls).toEqual([{ cmd: "library_load", args: {} }]);
  });

  it("add stamps an ISO timestamp and an event the backend can dedupe", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T12:00:00.000Z"));
    const calls = record({});
    await library.add(ITEM, { status: "planning" });

    expect(calls).toHaveLength(1);
    const { cmd, args } = calls[0];
    expect(cmd).toBe("library_add");
    expect(args.item).toBe(ITEM);
    expect(args.user).toEqual({ status: "planning" });
    expect(args).not.toHaveProperty("at");
    const event = args.event as Record<string, unknown>;
    expect(event.kind).toBe("library_add");
    expect(event.media_key).toBe("tmdb:tv:7");
    expect(event.at_utc).toBe("2026-09-25T12:00:00.000Z");
    expect(event.local_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(event.id)).toMatch(/[0-9a-f-]{8,}/);
  });

  it("gives every event its own id", async () => {
    const calls = record({});
    await library.add(ITEM);
    await library.add(ITEM);
    const ids = calls.map((c) => (c.args.event as { id: string }).id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("update sends only the patched fields", async () => {
    const calls = record({});
    await library.update("tmdb:tv:7", { progress: 5 });
    expect(calls[0].cmd).toBe("library_update");
    expect(calls[0].args.key).toBe("tmdb:tv:7");
    expect(calls[0].args.patch).toEqual({ progress: 5 });
  });

  it("plan sends the plan as a library_update patch with a library_plan event", async () => {
    const calls = record({});
    const plan = { days: [0, 2, 4], max_session_minutes: 60, since: "2026-10-01" };
    await library.plan("tmdb:tv:7", plan);
    await library.plan("tmdb:tv:7", null);
    expect(calls.map((c) => c.cmd)).toEqual(["library_update", "library_update"]);
    expect(calls[0].args.patch).toEqual({ plan });
    expect(calls[1].args.patch).toEqual({ plan: null });
    const event = calls[0].args.event as { kind: string; payload: unknown };
    expect(event.kind).toBe("library_plan");
    expect(event.payload).toEqual(plan);
    expect((calls[1].args.event as { payload: unknown }).payload).toBeNull();
  });

  it("remove sends the key and an event", async () => {
    const calls = record(true);
    await expect(library.remove("tmdb:tv:7")).resolves.toBe(true);
    expect(calls[0].cmd).toBe("library_remove");
    expect(calls[0].args.key).toBe("tmdb:tv:7");
    expect((calls[0].args.event as { kind: string }).kind).toBe("library_remove");
  });

  it("local_date is the user's calendar day, not UTC", async () => {
    vi.useFakeTimers();
    // 01:30 UTC on the 26th is still the 25th in UTC-3.
    vi.setSystemTime(new Date("2026-09-26T01:30:00.000Z"));
    const calls = record({});
    await library.add(ITEM);
    const event = calls[0].args.event as { local_date: string; at_utc: string };
    expect(event.at_utc).toBe("2026-09-26T01:30:00.000Z");
    expect(event.local_date).toBe(new Date("2026-09-26T01:30:00.000Z").toLocaleDateString("en-CA"));
  });

  it("retryPosters sends one library_retry_posters call", async () => {
    const calls = record(null);
    await library.retryPosters();
    expect(calls).toEqual([{ cmd: "library_retry_posters", args: {} }]);
  });

  it("events sends one library_events call and returns the log", async () => {
    const log = [{ id: "a", kind: "library_add", media_key: "tmdb:tv:7" }];
    const calls = record(log);
    expect(await library.events()).toEqual(log);
    expect(calls).toEqual([{ cmd: "library_events", args: {} }]);
  });
});

describe("live events", () => {
  it("hands every saved event to listeners, the same one that was sent", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    mockIPC((cmd, args) => {
      const a = args as Record<string, unknown>;
      calls.push({ cmd, args: a });
      if (cmd === "library_add") return { created_at: (a.event as { at_utc: string }).at_utc };
      return cmd === "library_remove" ? true : {};
    });
    const seen: unknown[] = [];
    const stop = library.onEvent((e) => seen.push(e));
    await library.add(ITEM);
    await library.update("tmdb:tv:7", { status: "completed" });
    await library.plan("tmdb:tv:7", null);
    await library.remove("tmdb:tv:7");
    stop();
    expect(seen).toEqual(calls.map((c) => c.args.event));
  });

  it("stays quiet when the backend logged nothing: a re-add or removing a missing item", async () => {
    mockIPC((cmd) => (cmd === "library_add" ? { created_at: "2026-01-01T00:00:00.000Z" } : false));
    const seen: unknown[] = [];
    const stop = library.onEvent((e) => seen.push(e));
    await library.add(ITEM);
    await library.remove("tmdb:tv:7");
    stop();
    expect(seen).toEqual([]);
  });

  it("stays quiet when the save is rejected", async () => {
    mockIPC(() => {
      throw new Error("disk full");
    });
    const seen: unknown[] = [];
    const stop = library.onEvent((e) => seen.push(e));
    await expect(library.update("tmdb:tv:7", { progress: 1 })).rejects.toThrow("disk full");
    stop();
    expect(seen).toEqual([]);
  });

  it("stops after unsubscribing", async () => {
    record(true);
    const seen: unknown[] = [];
    library.onEvent((e) => seen.push(e))();
    await library.remove("tmdb:tv:7");
    expect(seen).toEqual([]);
  });

  it("does not let a failing listener break the save", async () => {
    record(true);
    const listener = vi.fn(() => {
      throw new Error("listener bug");
    });
    const stop = library.onEvent(listener);
    await expect(library.remove("tmdb:tv:7")).resolves.toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    stop();
  });
});
