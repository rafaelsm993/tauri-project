import type { MediaKey, MediaType, ProviderId } from "./media";

// Mirror of `src-tauri/src/library/types.rs`, guarded by `library.contract.test.ts`.
export type LibraryStatus = "planning" | "in_progress" | "completed" | "dropped";

// Owned copy of the provider fields a library card needs.
export interface MediaSnapshot {
  media_key: MediaKey;
  provider: ProviderId;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  year: string | null;
}

// The user's own length data; only the planner requires it.
export interface Length {
  runtime_minutes: number | null;
  episodes: number | null;
  episode_minutes: number | null;
  chapters: number | null;
  chapter_minutes: number | null;
  pages: number | null;
  hours: number | null;
}

export interface UserData {
  status: LibraryStatus;
  progress: number;
  rating: number | null;
  review: string | null;
  length: Length;
}

export interface LibraryEntry {
  key: MediaKey;
  snapshot: MediaSnapshot;
  user: UserData;
  created_at: string;
  updated_at: string;
}

// One activity-log line; ids and dates are stamped by the frontend.
export interface LibraryEvent {
  id: string;
  kind: string;
  media_key: MediaKey;
  at_utc: string;
  local_date: string;
  payload: unknown;
}
