import type { Family } from "$lib/domain/dashboard";
import type { LibraryStatus } from "$lib/types/library";

// Chart colors come from the runtime tokens, so a theme change recolors the charts too.
export const FAMILY_COLORS: Record<Family, string> = {
  screen: "rgb(var(--clr-hue-screen-rgb))",
  anime: "rgb(var(--clr-hue-anime-rgb))",
  manga: "rgb(var(--clr-hue-manga-rgb))",
  book: "rgb(var(--clr-hue-book-rgb))",
  game: "rgb(var(--clr-hue-game-rgb))",
};

export const STATUS_COLORS: Record<LibraryStatus, string> = {
  planning: "rgb(var(--clr-ink-rgb) / 0.35)",
  in_progress: "rgb(var(--clr-highlight-rgb))",
  completed: "var(--clr-teal)",
  dropped: "var(--clr-error)",
};

export const XP_COLOR = "var(--clr-primary)";

// "3.5", "12", "140": one decimal only while it still matters.
export function formatHours(hours: number): string {
  return hours < 10 ? String(Number(hours.toFixed(1))) : String(Math.round(hours));
}

export const toDate = (day: string): Date => new Date(`${day}T00:00:00`);

export const shortDate = (d: Date): string =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
