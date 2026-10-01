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
    ({ list, events, seenLevel }) => {
      const library = structuredClone(list) as { key: string; user: Record<string, unknown> }[];
      const prefs = {
        background_animation: true,
        seen_level: seenLevel,
        reading_pages_per_hour: null,
      };
      const calls: { cmd: string; args: unknown }[] = [];
      Object.assign(window, { __ipcCalls: calls });
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: { key?: string; patch?: Record<string, unknown> }) => {
          calls.push({ cmd, args });
          if (cmd === "library_load") return structuredClone(library);
          if (cmd === "library_update") {
            const entry = library.find((e) => e.key === args?.key)!;
            Object.assign(entry.user, args?.patch);
            return structuredClone(entry);
          }
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
    { list: entries, events: fake.events ?? [], seenLevel: fake.seenLevel ?? 0 },
  );
}

export const ipcCalls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __ipcCalls: { cmd: string; args: unknown }[] }).__ipcCalls,
  );
