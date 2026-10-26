import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry, LibraryStatus } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

export function entry(
  id: number,
  type: MediaType = "movie",
  status: LibraryStatus = "completed",
  genres = ["Adventure"],
): LibraryEntry {
  const key = `manual:${type}:${id}`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "manual",
      media_type: type,
      title: `Story ${id}`,
      poster_path: null,
      poster_file: null,
      year: null,
      genres,
    },
    user: { status, progress: 1, rating: null, review: null, length: emptyLength(), plan: null },
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
}
