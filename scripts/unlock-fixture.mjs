import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

export async function buildUnlockFixture(day, catalog = {}) {
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  const root = fileURLToPath(new URL("../", import.meta.url));
  const vite = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    resolve: { alias: { $lib: path.join(root, "src/lib") } },
    logLevel: "error",
  });
  try {
    const g = await vite.ssrLoadModule("/src/lib/domain/gamification.ts");
    const c = await vite.ssrLoadModule("/src/lib/domain/completionAchievements.ts");
    const u = await vite.ssrLoadModule("/src/lib/domain/unlocks.ts");
    const { clampProgress } = await vite.ssrLoadModule("/src/lib/domain/progress.ts");
    const { statusForProgress } = await vite.ssrLoadModule("/src/lib/domain/status.ts");
    const target = Math.max(
      ...g.TITLES.map((t) => t.level),
      ...u.UNLOCKS.map((x) => x.level),
      ...c.ART_TIERS.map((t) => t.level),
    );
    const entries = {},
      events = [];
    let serial = 0,
      eventId = 0,
      catalogEntries = 0;
    const uuid = (n, prefix = "00000000") =>
      `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const at = (ago, minute = 0) =>
      new Date(Date.parse(day + "T12:00:00Z") - ago * 86400000 + minute * 60000).toISOString();
    function event(e, kind, payload, ago, minute) {
      const when = at(ago, minute);
      events.push({
        id: uuid(++eventId, "10000000"),
        kind,
        media_key: e.key,
        local_date: when.slice(0, 10),
        at_utc: when,
        payload,
      });
      e.updated_at = when;
    }
    for (const [t, type] of c.COMPLETION_TYPES.entries())
      for (let i = 0; i < 52; i++) {
        serial++;
        const complete = i < 50,
          active = i === 50;
        const source = complete ? catalog[type]?.[i] : null;
        const key = source?.snapshot.media_key ?? `manual:${type}:${uuid(serial)}`;
        if (source) catalogEntries++;
        const defaults = {
          movie: { runtime_minutes: 85 + (i % 12) * 7 },
          tv: { episodes: 6 + (i % 5) * 6, episode_minutes: 24 + (i % 3) * 10 },
          anime: { episodes: 12 + (i % 3) * 12, episode_minutes: 24 },
          manga: { chapters: 30 + (i % 8) * 20, chapter_minutes: 5 },
          book: { pages: 160 + (i % 10) * 32 },
          game: { hours: 5 + (i % 9) * 7 },
        };
        const length = {
          runtime_minutes: null,
          episodes: null,
          episode_minutes: null,
          chapters: null,
          chapter_minutes: null,
          pages: null,
          hours: null,
          ...defaults[type],
          ...source?.length,
        };
        const total = {
          movie: 1,
          tv: length.episodes,
          anime: length.episodes,
          manga: length.chapters,
          book: length.pages,
          game: length.hours,
        }[type];
        assert.ok(total > 0);
        const hours = g.hoursOf(type, length) ?? length.pages / 45;
        const finishAgo = complete
          ? i === 0
            ? t % 3
            : Math.floor((i / 49) ** 1.3 * 2100) + t * 7
          : 1;
        const duration = Math.max(2, Math.ceil(hours / 1.5) + (serial % 9));
        const startAgo = finishAgo + duration;
        const created = at(startAgo);
        const progress = complete
          ? total
          : active
            ? type === "movie"
              ? 0
              : Math.max(1, Math.floor(total * 0.4))
            : 0;
        const rating = complete && i % 4 !== 0 ? 5 + ((i * 7 + t) % 6) : null;
        const plan = active
          ? {
              days: [t % 7, (t + 2) % 7, (t + 4) % 7].sort((a, b) => a - b),
              max_session_minutes: [30, 45, 60][t % 3],
              since: day,
            }
          : null;
        const e = {
          key,
          snapshot: source
            ? { ...source.snapshot }
            : {
                media_key: key,
                provider: "manual",
                media_type: type,
                title: `ZZTest ${type} ${complete ? i + 1 : active ? "ongoing journal" : "next on my list"}`,
                poster_path: null,
                poster_file: null,
                year: null,
              },
          user: {
            status: statusForProgress(type, progress, total),
            progress,
            rating,
            review:
              complete && i % 11 === 0
                ? "Simulated test history: enjoyed the pacing and atmosphere."
                : null,
            length,
            plan,
          },
          created_at: created,
          updated_at: created,
        };
        assert.ok(!entries[key], "Duplicate catalog identity");
        entries[key] = e;
        event(e, "library_add", { status: "planning", progress: 0, length }, startAgo, 0);
        if (complete || active) {
          const steps = complete ? 3 : 2;
          for (let step = 1; step <= steps; step++) {
            const ago = startAgo - Math.floor((duration * step) / (steps + 1));
            const partial =
              type === "movie"
                ? clampProgress(type, step / (steps + 1))
                : Math.max(1, Math.min(total - 1, Math.floor((progress * step) / (steps + 1))));
            if (partial > 0 && partial < total)
              event(e, "library_update", { progress: partial, status: "in_progress" }, ago, step);
          }
          event(
            e,
            "library_update",
            { status: e.user.status, progress, length, rating, review: e.user.review },
            finishAgo,
            15,
          );
        }
        if (plan) event(e, "library_plan", { plan }, 0, t);
      }
    events.sort((a, b) => a.at_utc.localeCompare(b.at_utc) || a.id.localeCompare(b.id));
    const list = Object.values(entries);
    const xp = g.totalXp(g.awards(events, g.savedLengths(list)));
    const level = g.levelOf(xp).level;
    assert.ok(level >= target, "Fixture must genuinely earn every current content threshold");
    const avatars = c.completionAchievements(list, level);
    const summary = {
      level,
      xp,
      completed: list.filter((e) => e.user.status === "completed").length,
      avatarRewards: avatars.length,
      unlockedAvatars: avatars.filter((a) => a.unlocked).length,
      globalRewards: u.UNLOCKS.length,
      unlockedGlobalRewards: u.unlockedIds(level).length,
      titles: g.TITLES.length,
      earnedTitles: g.TITLES.filter((t) => t.level <= level).length,
      catalogEntries,
      simulatedHistory: true,
      historyFrom: events[0].local_date,
      historyThrough: events.at(-1).local_date,
    };
    assert.equal(summary.unlockedAvatars, summary.avatarRewards);
    assert.equal(summary.unlockedGlobalRewards, summary.globalRewards);
    assert.equal(summary.earnedTitles, summary.titles);
    return {
      library: { schema_version: 3, data: { entries, merged: {}, retyped: {} } },
      events,
      summary,
    };
  } finally {
    await vite.close();
  }
}
