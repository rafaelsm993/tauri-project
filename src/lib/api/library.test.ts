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
    expect(args.at).toBe("2026-09-25T12:00:00.000Z");
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
});
