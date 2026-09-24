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

// Progress units per media type and the rating scale are not decided yet.
export interface UserData {
  status: LibraryStatus;
  progress: number;
  rating: number | null;
  review: string | null;
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
