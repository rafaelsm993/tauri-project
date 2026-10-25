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

  it("follows a type change heard after the load, and a change back leaves no loop", () => {
    const M2 = "manual:manga:m1";
    const moved = withAliasEvents({}, [ev("library_retype", M, { into: M2 })]);
    expect(moved).toEqual({ [M]: M2 });
    const back = withAliasEvents(moved, [ev("library_retype", M2, { into: M }, "r2")]);
    expect(back).toEqual({ [M2]: M });
    expect(resolve(M, back)).toBe(M);
    expect(resolve(M2, back)).toBe(M);
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

import { mergeChanges } from "./reconcile";
import { emptyLength } from "./length";
import type { LibraryEntry } from "$lib/types/library";

function anime(over: {
  title?: string;
  year?: string | null;
  episodes?: number | null;
  episode_minutes?: number | null;
  status?: LibraryEntry["user"]["status"];
  progress?: number;
  rating?: number | null;
}): LibraryEntry {
  return {
    key: "manual:anime:1",
    snapshot: {
      media_key: "manual:anime:1",
      provider: "manual",
      media_type: "anime",
      title: over.title ?? "berserk",
      poster_path: null,
      poster_file: null,
      year: over.year ?? null,
    },
    user: {
      status: over.status ?? "in_progress",
      progress: over.progress ?? 30,
      rating: over.rating ?? 8,
      review: null,
      length: {
        ...emptyLength(),
        episodes: over.episodes ?? null,
        episode_minutes: over.episode_minutes ?? null,
      },
      plan: null,
    },
    created_at: "t",
    updated_at: "t",
  } as LibraryEntry;
}

describe("mergeChanges", () => {
  it("lists only what changes, old → new, and names what stays", () => {
    const mine = anime({ episodes: 300 });
    const merged = anime({
      title: "Berserk",
      year: "1997",
      episodes: 25,
      episode_minutes: 25,
      status: "completed",
      progress: 25,
    });
    const out = mergeChanges(mine, merged);
    expect(out.changed).toEqual([
      { label: "Title", before: "berserk", after: "Berserk" },
      { label: "Year", before: "", after: "1997" },
      { label: "Episodes", before: "300", after: "25" },
      { label: "Minutes per episode", before: "", after: "25" },
      { label: "Status", before: "In progress", after: "Completed" },
      { label: "Progress", before: "30 of 300 episodes", after: "25 of 25 episodes" },
    ]);
    expect(out.kept).toEqual(["Rating"]);
    expect(out.capped).toBe(true);
  });

  it("is empty when nothing changes, and a finished item was not capped", () => {
    const done = anime({ episodes: 25, status: "completed", progress: 25 });
    expect(mergeChanges(done, done)).toEqual({
      changed: [],
      kept: ["Title", "Episodes", "Status", "Progress", "Rating"],
      capped: false,
    });
  });

  it("flags a completed item's reduced progress and distinguishes long text and plan days", () => {
    const before = anime({ episodes: 300, progress: 300, status: "completed" });
    before.user.review = "The same long opening text that takes more than forty characters. First";
    before.snapshot.overview =
      "The same long opening text that takes more than forty characters. First";
    before.user.plan = { days: [0], max_session_minutes: 45, since: "2026-10-01" };
    const after = structuredClone(before);
    after.user.progress = 25;
    after.user.length.episodes = 25;
    after.user.review = "The same long opening text that takes more than forty characters. Second";
    after.snapshot.overview =
      "The same long opening text that takes more than forty characters. Second";
    after.user.plan = { days: [1], max_session_minutes: 45, since: "2026-10-01" };
    const diff = mergeChanges(before, after);
    expect(diff.capped).toBe(true);
    expect(diff.changed.find((row) => row.label === "Review")?.after).toContain("Second");
    expect(diff.changed.find((row) => row.label === "Overview")?.after).toContain("Second");
    expect(diff.changed.find((row) => row.label === "Plan")?.after).toContain("Tue");
  });
});

describe("merge comparison edge cases", () => {
  it("does not hide review changes after a shared long prefix", () => {
    const mine = anime({});
    mine.user.review = "A".repeat(60) + " old";
    const next = structuredClone(mine);
    next.user.review = "A".repeat(60) + " new";
    expect(mergeChanges(mine, next).changed).toContainEqual({
      label: "Review",
      before: mine.user.review,
      after: next.user.review,
    });
  });
  it("shows a plan's changed days even when its minutes stay the same", () => {
    const mine = anime({});
    mine.user.plan = { days: [0], max_session_minutes: 30, since: "2026-10-24" };
    const next = structuredClone(mine);
    next.user.plan!.days = [1];
    expect(mergeChanges(mine, next).changed).toContainEqual({
      label: "Plan",
      before: "30 min per session · Mon · since 2026-10-24",
      after: "30 min per session · Tue · since 2026-10-24",
    });
  });
  it("a previously completed item still warns when its progress is reduced", () => {
    const mine = anime({ episodes: 300, progress: 30, status: "completed" });
    const next = anime({ episodes: 25, progress: 25, status: "completed" });
    expect(mergeChanges(mine, next).capped).toBe(true);
  });
});
