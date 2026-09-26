import type { MediaType } from "$lib/types/media";

// Up to two initials for avatar fallbacks.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Runtime is minutes, except books where it's pages.
export function formatRuntime(runtime: number | null | undefined, type: MediaType): string {
  if (!runtime) return "";
  return type === "book" ? `${runtime} pages` : `${Math.floor(runtime / 60)}h ${runtime % 60}m`;
}

export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

// Short English date ("Sep 20, 2026"); anything unparseable is shown unchanged.
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
