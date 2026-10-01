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

// A local `YYYY-MM-DD` as "Fri, Oct 16"; read at UTC midnight so no time zone shifts the day.
export function formatDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// "45 min", "1 h", "1 h 30 min".
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
