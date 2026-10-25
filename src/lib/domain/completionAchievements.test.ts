import { describe, expect, it } from "vitest";
import {
  ART_TIERS,
  COMPLETION_TYPES,
  completionAchievements,
  effectiveProfileArt,
} from "./completionAchievements";
import { emptyLength } from "./length";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";
import type { MediaType, ProviderId } from "$lib/types/media";

function entry(
  id: number,
  type: MediaType = "manga",
  status: LibraryStatus = "completed",
): LibraryEntry {
  const providers: Record<MediaType, ProviderId> = {
    movie: "tmdb",
    tv: "tmdb",
    anime: "anilist",
    manga: "anilist",
    book: "itunes",
    game: "rawg",
  };
  const provider = providers[type];
  const key = `${provider}:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider,
      media_type: type,
      title: `Story ${id}`,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status,
      progress: status === "completed" ? 1 : 0,
      rating: null,
      review: null,
      length: emptyLength(),
      plan: null,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

function completed(count: number, type: MediaType = "manga") {
  return Array.from({ length: count }, (_, i) => entry(i + 1, type));
}

describe("completionAchievements", () => {
  it("earns a first manga crest from a current completed entry", () => {
    const list = completionAchievements([entry(1)], 1);
    expect(list.find((a) => a.id === "manga:1")).toEqual({
      id: "manga:1",
      type: "manga",
      name: "Panel Keeper",
      tier: 1,
      count: 1,
      required: 1,
      level: 1,
      unlocked: true,
    });
  });

  it("exposes six ordered ladders with five unique stable artwork IDs each", () => {
    const types = ["movie", "tv", "anime", "manga", "book", "game"];
    const required = [1, 5, 10, 25, 50];
    const list = completionAchievements([], 1);
    expect(COMPLETION_TYPES).toEqual(types);
    expect(ART_TIERS).toEqual([
      { completed: 1, level: 1 },
      { completed: 5, level: 3 },
      { completed: 10, level: 5 },
      { completed: 25, level: 8 },
      { completed: 50, level: 12 },
    ]);
    expect(list.map((a) => a.id)).toEqual(types.flatMap((t) => required.map((n) => `${t}:${n}`)));
    expect(new Set(list.map((a) => a.id)).size).toBe(30);
    expect(list.every((a) => !a.unlocked && a.count === 0)).toBe(true);
  });

  const types: MediaType[] = ["movie", "tv", "anime", "manga", "book", "game"];
  const tiers = [
    [1, 1],
    [5, 3],
    [10, 5],
    [25, 8],
    [50, 12],
  ] as const;
  const boundaries = types.flatMap((type) =>
    tiers.flatMap(([required, level]) => [
      { type, required, count: required - 1, level, unlocked: false },
      { type, required, count: required, level, unlocked: true },
      { type, required, count: required + 1, level, unlocked: true },
      { type, required, count: required, level: level - 1, unlocked: false },
    ]),
  );

  it.each(boundaries)(
    "$type:$required with $count completions at level $level => $unlocked",
    ({ type, required, count, level, unlocked }) => {
      const achievement = completionAchievements(completed(count, type), level).find(
        (a) => a.id === `${type}:${required}`,
      )!;
      expect(achievement.count).toBe(count);
      expect(achievement.unlocked).toBe(unlocked);
    },
  );

  it("does not combine movie and TV completions", () => {
    const list = completionAchievements([...completed(4, "movie"), ...completed(5, "tv")], 12);
    expect(list.find((a) => a.id === "movie:5")).toMatchObject({ count: 4, unlocked: false });
    expect(list.find((a) => a.id === "tv:5")).toMatchObject({ count: 5, unlocked: true });
  });

  it("counts a series once rather than counting its completed episodes", () => {
    const series = entry(1, "anime");
    series.user.progress = 100;
    series.user.length.episodes = 100;
    const list = completionAchievements([series], 12);
    expect(list.find((a) => a.id === "anime:5")).toMatchObject({ count: 1, unlocked: false });
  });

  it("ignores planning, in-progress and dropped entries regardless of progress or rating", () => {
    const statuses: LibraryStatus[] = ["planning", "in_progress", "dropped"];
    const saved = statuses.map((status, i) => {
      const item = entry(i, "manga", status);
      item.user.progress = 999;
      item.user.rating = 10;
      return item;
    });
    expect(completionAchievements(saved, 50).every((a) => !a.unlocked && a.count === 0)).toBe(true);
  });

  it("counts canonical completed status without needing a completion XP event or known length", () => {
    expect(completionAchievements([entry(1)], 1).find((a) => a.id === "manga:1")?.unlocked).toBe(
      true,
    );
  });

  it("does not multiply a completed entry by genres or duplicate keys", () => {
    const saved = entry(1);
    saved.snapshot.genres = ["Action", "Comedy", "action"];
    const list = completionAchievements([saved, structuredClone(saved)], 12);
    expect(list.find((a) => a.id === "manga:5")).toMatchObject({ count: 1, unlocked: false });
  });

  it("relocks when an entry is uncompleted while the global level stays unchanged", () => {
    const saved = completed(5);
    expect(completionAchievements(saved, 8).find((a) => a.id === "manga:5")?.unlocked).toBe(true);
    saved[0].user.status = "in_progress";
    expect(completionAchievements(saved, 8).find((a) => a.id === "manga:5")).toMatchObject({
      count: 4,
      unlocked: false,
    });
  });

  it("recomputes after deletion, merge or backup replacement without a permanent earned ledger", () => {
    const saved = completed(5);
    expect(completionAchievements(saved, 8).find((a) => a.id === "manga:5")?.unlocked).toBe(true);
    expect(
      completionAchievements(saved.slice(1), 8).find((a) => a.id === "manga:5")?.unlocked,
    ).toBe(false);
    expect(completionAchievements([], 8).every((a) => !a.unlocked)).toBe(true);
    expect(completionAchievements(saved, 8).find((a) => a.id === "manga:5")?.unlocked).toBe(true);
  });

  it("does not carry completions across a manual retype that resets progress", () => {
    const saved = [...completed(4), entry(5, "book", "planning")];
    const list = completionAchievements(saved, 8);
    expect(list.find((a) => a.id === "manga:5")).toMatchObject({ count: 4, unlocked: false });
    expect(list.find((a) => a.id === "book:1")).toMatchObject({ count: 0, unlocked: false });
  });

  it("is stable under shuffled input and leaves library entries unchanged", () => {
    const saved = [...completed(5), ...completed(2, "tv")];
    const before = structuredClone(saved);
    const forward = completionAchievements(saved, 8);
    expect(completionAchievements([...saved].reverse(), 8)).toEqual(forward);
    expect(saved).toEqual(before);
  });
});

describe("effectiveProfileArt", () => {
  it("uses the selected art only when both current requirements are met", () => {
    expect(effectiveProfileArt("manga:5", completed(5), 3)).toBe("manga:5");
    expect(effectiveProfileArt("manga:5", completed(4), 3)).toBe("default");
    expect(effectiveProfileArt("manga:5", completed(5), 2)).toBe("default");
  });

  it.each(["default", "unknown", "manga:99", "", "movie:5"])(
    "falls back safely for %j",
    (selected) => {
      expect(effectiveProfileArt(selected, completed(5), 8)).toBe("default");
    },
  );

  it("restores a stored selection when current requirements are regained", () => {
    const selected = "manga:5";
    const saved = completed(5);
    expect(effectiveProfileArt(selected, saved, 8)).toBe(selected);
    expect(effectiveProfileArt(selected, saved.slice(1), 8)).toBe("default");
    expect(effectiveProfileArt(selected, saved, 8)).toBe(selected);
  });
});
