import type { Page } from "@playwright/test";

const LENGTH = {
  runtime_minutes: null,
  episodes: null,
  episode_minutes: null,
  chapters: null,
  chapter_minutes: null,
  pages: null,
  hours: null,
};

// A hand-made entry under a fixed manual key.
export function manualItem(type: string, title: string, extra: object = {}) {
  const key = `manual:${type}:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69`;
  const base = item(0, type, title, {}, null);
  return {
    ...base,
    key,
    snapshot: { ...base.snapshot, media_key: key, provider: "manual", year: null, ...extra },
    user: { ...base.user, status: "planning" },
  };
}

export function item(id: number, type: string, title: string, length: object, plan: object | null) {
  const key = `tmdb:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "tmdb",
      media_type: type,
      title,
      poster_path: null,
      year: "2024",
      poster_file: null,
    },
    user: {
      status: "in_progress",
      progress: 0,
      rating: null,
      review: null,
      length: { ...LENGTH, ...length },
      plan,
    },
    created_at: "2026-09-25T00:00:00Z",
    updated_at: "2026-09-25T00:00:00Z",
  };
}

export interface LibraryFake {
  events?: object[];
  // What catalog_page answers; empty by default.
  results?: object[];
  seenLevel?: number;
  // Whether the Animations setting is on; the animated reward slots need it.
  motion?: boolean;
  now?: string;
  // Saved preferences to start from, over the defaults below.
  prefs?: Record<string, unknown>;
  // What catalog_detail adds for a key, e.g. { "tmdb:tv:4": { runtime: 40, episodes: 9 } }.
  details?: Record<string, object>;
}

// A stateful fake: library_update merges its patch, so a saved plan shows up on the page.
export async function mockLibrary(page: Page, entries: object[], fake: LibraryFake = {}) {
  await page.clock.setFixedTime(new Date(fake.now ?? "2026-10-01T10:00:00"));
  await page.addInitScript(
    ({ list, events, seenLevel, motion, emptyLength, results, savedPrefs, details }) => {
      const library = structuredClone(list) as {
        key: string;
        user: Record<string, unknown>;
        snapshot?: { title: string; provider: string };
      }[];
      // Established user by default; welcome.spec sets __freshInstall to be greeted instead.
      const prefs = {
        motion,
        seen_level: seenLevel,
        reading_pages_per_hour: null,
        manga_chapter_minutes: null,
        theme: "system",
        welcomed: !(window as { __freshInstall?: boolean }).__freshInstall,
        welcome_beat: 0,
        taste_families: [] as string[],
        taste_genres: [] as string[],
        accent: "default",
        pack: "default",
        motif: "default",
        garden: "default",
        title: "automatic",
        profile_art: "default",
        particle_count: 12,
        ...savedPrefs,
      };
      type Hit = { media_key: string; media_type: string; title: string; provider: string };
      const calls: { cmd: string; args: unknown }[] = [];
      // Like Rust's tombstones: what a merge replaced, so Undo can put it back.
      const merged = new Map<string, { manual: unknown; into: string; catalog: unknown }>();
      const mergedEntry = (key: string, item: Hit) => {
        const mine = library.find((e) => e.key === key)!;
        return {
          ...structuredClone(mine),
          key: item.media_key,
          snapshot: {
            media_key: item.media_key,
            provider: item.provider,
            media_type: item.media_type,
            title: item.title,
            poster_path: null,
            poster_file: null,
            year: "2020",
          },
        };
      };
      Object.assign(window, { __ipcCalls: calls });
      const invoke = async (
        cmd: string,
        args?: {
          key?: string;
          patch?: Record<string, unknown>;
          draft?: Record<string, unknown>;
          user?: Record<string, unknown>;
          length?: Record<string, unknown>;
          event?: { at_utc: string };
          id?: string;
          media_type?: string;
          item?: Hit;
        },
      ) => {
        calls.push({ cmd, args });
        // Tests set window.__offline to make every provider call fail.
        if ((window as { __offline?: boolean }).__offline && cmd.startsWith("catalog_")) {
          throw "offline: network unreachable";
        }
        if (cmd === "library_load") return structuredClone(library);
        // Manual saves: the fake makes a counted key and stores the draft as the snapshot.
        if (cmd === "library_add_manual" || cmd === "library_edit_manual") {
          const draft = args!.draft!;
          const at = args!.event!.at_utc;
          const key =
            args?.key ??
            `manual:${draft.media_type}:00000000-0000-4000-8000-${String(library.length).padStart(12, "0")}`;
          const old = library.find((e) => e.key === key) as Record<string, unknown> | undefined;
          const entry = {
            key,
            snapshot: {
              media_key: key,
              provider: "manual",
              poster_path: null,
              poster_file: null,
              ...draft,
              year: (draft.year as string) || null,
            },
            user: old?.user ?? {
              status: "planning",
              progress: 0,
              rating: null,
              review: null,
              length: emptyLength,
              plan: null,
              ...args?.user,
            },
            created_at: old?.created_at ?? at,
            updated_at: at,
          };
          const at_i = library.findIndex((e) => e.key === key);
          if (at_i >= 0) library.splice(at_i, 1);
          library.push(entry as unknown as (typeof library)[number]);
          return structuredClone(entry);
        }
        // Like Rust: same id under the new type, progress and plan start over.
        if (cmd === "library_retype_manual") {
          const draft = args!.draft!;
          const at_i = library.findIndex((e) => e.key === args?.key);
          const old = library[at_i] as unknown as {
            snapshot: Record<string, unknown>;
            user: Record<string, unknown>;
            created_at: string;
          };
          const key = `manual:${draft.media_type}:${args!.key!.split(":").slice(2).join(":")}`;
          const entry = {
            key,
            snapshot: { ...old.snapshot, ...draft, media_key: key },
            user: { ...old.user, progress: 0, plan: null, length: args!.length },
            created_at: old.created_at,
            updated_at: args!.event!.at_utc,
          };
          library.splice(at_i, 1, entry as unknown as (typeof library)[number]);
          return structuredClone(entry);
        }
        if (cmd === "library_update") {
          const entry = library.find((e) => e.key === args?.key)!;
          Object.assign(entry.user, args?.patch);
          return structuredClone(entry);
        }
        if (cmd === "library_remove") {
          const at_i = library.findIndex((e) => e.key === args?.key);
          if (at_i >= 0) library.splice(at_i, 1);
          return at_i >= 0;
        }
        // Like Rust: a provider can't parse the UUID of a hand-made item.
        if (cmd === "catalog_detail" && String(args?.id).includes("-")) throw "Invalid ID.";
        if (cmd === "catalog_detail") {
          const saved = library.find((e) => e.key.endsWith(`:${args?.media_type}:${args?.id}`));
          const s = saved?.snapshot;
          return {
            id: Number(args?.id),
            provider: s?.provider ?? "tmdb",
            media_key: saved?.key ?? `tmdb:${args?.media_type}:${args?.id}`,
            media_type: args?.media_type,
            title: s?.title ?? "Untitled",
            tagline: "",
            overview: "",
            poster_path: null,
            backdrop_path: null,
            vote_average: 0,
            vote_count: 0,
            release_date: "",
            runtime: null,
            genres: [],
            cast: [],
            videos: [],
            ...(details[saved?.key ?? `tmdb:${args?.media_type}:${args?.id}`] ?? {}),
          };
        }
        if (cmd === "library_events") return structuredClone(events);
        if (cmd === "startup_status") return null;
        if (cmd === "library_poster_dir") return "/nonexistent/posters";
        if (cmd === "prefs_load") return { ...prefs };
        if (cmd === "prefs_update") {
          // Rust's PrefsPatch is deny_unknown_fields; mirror it so a rejected save is not green.
          const patch = (args?.patch ?? {}) as Record<string, unknown>;
          const unknown = Object.keys(patch).filter((k) => !(k in prefs));
          if (unknown.length > 0) throw `unknown field \`${unknown[0]}\``;
          return Object.assign(prefs, patch);
        }
        if (cmd === "library_merge_preview") {
          const combined = library.some((e) => e.key === args!.item.media_key);
          return { entry: mergedEntry(args!.key!, args!.item!), combined };
        }
        if (cmd === "library_merge") {
          const entry = mergedEntry(args!.key!, args!.item!);
          const at_m = library.findIndex((e) => e.key === args!.key);
          const at_c = library.findIndex((e) => e.key === entry.key);
          merged.set(args!.key!, {
            manual: library[at_m],
            into: entry.key,
            catalog: at_c >= 0 ? library[at_c] : null,
          });
          library.splice(at_m, 1);
          if (at_c >= 0)
            library.splice(
              library.findIndex((e) => e.key === entry.key),
              1,
            );
          library.push(entry);
          return structuredClone(entry);
        }
        if (cmd === "library_unmerge") {
          const t = merged.get(args!.key!);
          if (!t) throw "this item was not matched";
          merged.delete(args!.key!);
          library.splice(
            library.findIndex((e) => e.key === t.into),
            1,
          );
          library.push(t.manual as (typeof library)[number]);
          if (t.catalog) library.push(t.catalog as (typeof library)[number]);
          return structuredClone(t);
        }
        if (cmd === "library_aliases") {
          return Object.fromEntries([...merged].map(([k, t]) => [k, t.into]));
        }
        if (cmd === "catalog_page") {
          return { page: 1, total_pages: 1, total_results: results.length, results, genres: [] };
        }
        return { page: 1, total_pages: 1, total_results: 0, results: [], genres: [] };
      };
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke,
        transformCallback: () => 0,
        convertFileSrc: (path: string) => `/missing-asset/${encodeURIComponent(path)}`,
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      };
    },
    {
      list: entries,
      events: fake.events ?? [],
      seenLevel: fake.seenLevel ?? 0,
      motion: fake.motion ?? true,
      emptyLength: LENGTH,
      results: fake.results ?? [],
      savedPrefs: fake.prefs ?? {},
      details: fake.details ?? {},
    },
  );
}

export const ipcCalls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ipcCalls: { cmd: string; args: unknown }[] }).__ipcCalls,
  );
