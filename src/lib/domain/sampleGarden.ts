import type { LibraryEntry } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

const LENGTH = {
  runtime_minutes: null,
  episodes: null,
  episode_minutes: null,
  chapters: null,
  chapter_minutes: null,
  pages: null,
  hours: null,
};

type Seed = {
  type: MediaType;
  title: string;
  status: LibraryEntry["user"]["status"];
  progress?: number;
};

// A made-up library, shown once on the welcome's first beat so the garden has something to grow.
// Five plants: the narrowest supported width fits five tracks, so the bed never wraps to a
// lonely second row with a stub of soil under it. Every family and every stage appears once.
const SEEDS: Seed[] = [
  { type: "book", title: "The Long Way", status: "completed" },
  { type: "movie", title: "Northern Lights", status: "in_progress", progress: 60 },
  { type: "anime", title: "Summer Signal", status: "in_progress", progress: 25 },
  { type: "manga", title: "Paper Cranes", status: "planning" },
  { type: "game", title: "Hollow Vale", status: "dropped" },
];

export const SAMPLE_GARDEN: LibraryEntry[] = SEEDS.map((seed, i) => {
  const key = `sample:${seed.type}:${i}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "manual",
      media_type: seed.type,
      title: seed.title,
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status: seed.status,
      progress: seed.progress ?? 0,
      rating: null,
      review: null,
      length: { ...LENGTH },
      plan: null,
    },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as LibraryEntry;
});
