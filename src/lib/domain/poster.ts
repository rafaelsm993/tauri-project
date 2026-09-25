import { convertFileSrc } from "@tauri-apps/api/core";
import type { MediaSnapshot } from "$lib/types/library";

// Local copy first, then the provider URL; the card steps through them on image errors.
export function posterSources(
  snapshot: Pick<MediaSnapshot, "poster_file" | "poster_path">,
  dir: string | null,
  toSrc: (path: string) => string = convertFileSrc,
): string[] {
  const sep = dir?.includes("\\") ? "\\" : "/";
  const local = snapshot.poster_file && dir ? toSrc(`${dir}${sep}${snapshot.poster_file}`) : null;
  return [local, snapshot.poster_path].filter((s): s is string => !!s);
}
