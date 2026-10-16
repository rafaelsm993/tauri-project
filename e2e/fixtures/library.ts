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
  seenLevel?: number;
  now?: string;
}

// A stateful fake: library_update merges its patch, so a saved plan shows up on the page.
export async function mockLibrary(page: Page, entries: object[], fake: LibraryFake = {}) {
  await page.clock.setFixedTime(new Date(fake.now ?? "2026-10-01T10:00:00"));
  await page.addInitScript(
    ({ list, events, seenLevel, emptyLength }) => {
      const library = structuredClone(list) as { key: string; user: Record<string, unknown> }[];
      const prefs = {
        motion: true,
        seen_level: seenLevel,
        reading_pages_per_hour: null,
      };
      const calls: { cmd: string; args: unknown }[] = [];
      Object.assign(window, { __ipcCalls: calls });
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (
          cmd: string,
          args?: {
            key?: string;
            patch?: Record<string, unknown>;
            draft?: Record<string, unknown>;
            user?: Record<string, unknown>;
            event?: { at_utc: string };
            id?: string;
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
          if (cmd === "library_events") return structuredClone(events);
          if (cmd === "startup_status") return null;
          if (cmd === "library_poster_dir") return "/nonexistent/posters";
          if (cmd === "prefs_load") return { ...prefs };
          if (cmd === "prefs_update") return Object.assign(prefs, args?.patch);
          return { page: 1, total_pages: 1, total_results: 0, results: [], genres: [] };
        },
        transformCallback: () => 0,
        convertFileSrc: (path: string) => `/missing-asset/${encodeURIComponent(path)}`,
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      };
    },
    {
      list: entries,
      events: fake.events ?? [],
      seenLevel: fake.seenLevel ?? 0,
      emptyLength: LENGTH,
    },
  );
}

export const ipcCalls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ipcCalls: { cmd: string; args: unknown }[] }).__ipcCalls,
  );
