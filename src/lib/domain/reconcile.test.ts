import { describe, expect, it } from "vitest";
import { asAliases, rekey, resolve, withAliasEvents } from "./reconcile";
import type { LibraryEvent } from "$lib/types/library";

const M = "manual:book:m1";
const C = "itunes:book:42";

function ev(kind: string, media_key: string, payload: unknown = null, id = kind): LibraryEvent {
  return { id, kind, media_key, at_utc: "", local_date: "2026-10-19", payload };
}

describe("aliases", () => {
  it("adds a merge heard after the load and drops an undone one", () => {
    const merged = withAliasEvents({}, [ev("library_merge", M, { into: C })]);
    expect(merged).toEqual({ [M]: C });
    expect(withAliasEvents(merged, [ev("library_unmerge", M, { into: C })])).toEqual({});
  });

  it("keeps the saved aliases and ignores other kinds and payloads without a key", () => {
    const saved = { "manual:movie:x": "tmdb:movie:1" };
    const heard = [
      ev("library_update", M, { into: C }),
      ev("library_merge", M, null),
      ev("library_merge", M, { into: 7 }),
    ];
    expect(withAliasEvents(saved, heard)).toEqual(saved);
  });

  it("follows a chain to its end and stops on a cycle", () => {
    expect(resolve("a", { a: "b", b: "c" })).toBe("c");
    expect(resolve("a", { a: "b", b: "a" })).toBe("b");
    expect(resolve(C, { [M]: C })).toBe(C);
  });

  it("reads only a plain map of strings from the backend", () => {
    expect(asAliases({ [M]: C, bad: 3 })).toEqual({ [M]: C });
    expect(asAliases([M, C])).toEqual({});
    expect(asAliases(null)).toEqual({});
    expect(asAliases({ results: [], total_pages: 0 })).toEqual({});
  });
});

describe("rekey", () => {
  it("files a merged item's history under its catalog key and leaves the rest", () => {
    const log = [ev("library_add", M, null, "1"), ev("library_add", "tmdb:movie:9", null, "2")];
    expect(rekey(log, { [M]: C }).map((e) => e.media_key)).toEqual([C, "tmdb:movie:9"]);
    expect(log[0].media_key).toBe(M);
  });

  it("returns the same log when nothing was merged", () => {
    const log = [ev("library_add", M)];
    expect(rekey(log, {})).toBe(log);
  });
});
