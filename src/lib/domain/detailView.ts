import { detailPath } from "./libraryView";
import type { LibraryEntry, MediaSnapshot } from "$lib/types/library";
import type { MediaDetail, MediaItem } from "$lib/types/media";

export type DetailSource =
  | { kind: "loading" }
  | { kind: "detail"; detail: MediaDetail }
  | { kind: "saved"; entry: LibraryEntry }
  | { kind: "error"; message: string };

// The saved entry a detail URL points at; the URL has no provider, keys do.
export function entryForRoute(
  entries: LibraryEntry[],
  type: string,
  id: string,
): LibraryEntry | undefined {
  return entries.find((e) => {
    const path = detailPath(e);
    return path.type === type && path.id === id;
  });
}

export const GONE = "This item isn't in your library anymore.";

// What the detail page can show: the provider's answer, else your saved copy, else the error.
// A hand-made item (`manual`) has no provider, so it is your copy or gone.
export function detailSource(state: {
  loading: boolean;
  detail: MediaDetail | null;
  error: string;
  entry: LibraryEntry | undefined;
  manual?: boolean;
}): DetailSource {
  if (state.manual) {
    if (state.entry) return { kind: "saved", entry: state.entry };
    return state.loading ? { kind: "loading" } : { kind: "error", message: GONE };
  }
  if (state.loading) return { kind: "loading" };
  if (state.detail) return { kind: "detail", detail: state.detail };
  if (state.entry) return { kind: "saved", entry: state.entry };
  return { kind: "error", message: state.error };
}

// A catalog item rebuilt from the saved copy, for the library controls when offline.
export function snapshotItem(snapshot: MediaSnapshot): MediaItem {
  return {
    id: snapshot.media_key.split(":").slice(2).join(":"),
    provider: snapshot.provider,
    media_key: snapshot.media_key,
    media_type: snapshot.media_type,
    title: snapshot.title,
    overview: "",
    poster_path: snapshot.poster_path,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    release_date: snapshot.year ?? undefined,
  };
}
