import { isBinary } from "./progress";
import type { LibraryEntry, LibraryStatus, UserData } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

// The status a progress value implies: nothing yet, partway, or done. Without a total it never finishes.
export function statusForProgress(
  type: MediaType,
  progress: number,
  total: number | null,
): LibraryStatus {
  if (isBinary(type)) return progress > 0 ? "completed" : "planning";
  if (progress <= 0) return "planning";
  if (total !== null && progress >= total) return "completed";
  return "in_progress";
}

// What a hand-made progress change saves; a dropped item stays dropped until Resume.
export function progressPatch(
  entry: LibraryEntry,
  progress: number,
  total: number | null,
): Pick<UserData, "progress"> & Partial<Pick<UserData, "status">> {
  if (entry.user.status === "dropped") return { progress };
  const status = statusForProgress(entry.snapshot.media_type, progress, total);
  return status === entry.user.status ? { progress } : { progress, status };
}

// Resume: back to whatever the progress says.
export function resumeStatus(entry: LibraryEntry, total: number | null): LibraryStatus {
  return statusForProgress(entry.snapshot.media_type, entry.user.progress, total);
}
