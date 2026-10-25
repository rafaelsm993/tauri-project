import type { LibraryEntry } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

export const COMPLETION_TYPES: readonly MediaType[] = [
  "movie",
  "tv",
  "anime",
  "manga",
  "book",
  "game",
];
export const ART_TIERS = [
  { completed: 1, level: 1 },
  { completed: 5, level: 3 },
  { completed: 10, level: 5 },
  { completed: 25, level: 8 },
  { completed: 50, level: 12 },
] as const;
const ART_NAMES: Record<MediaType, string> = {
  movie: "Silver Screen",
  tv: "Signal Keeper",
  anime: "Starlit Frame",
  manga: "Panel Keeper",
  book: "Bound Archivist",
  game: "Quest Sigil",
};
export function completionAchievements(entries: LibraryEntry[], currentLevel: number) {
  const unique = [...new Map(entries.map((e) => [e.key, e])).values()];
  return COMPLETION_TYPES.flatMap((type) => {
    const count = unique.filter(
      (e) => e.snapshot.media_type === type && e.user.status === "completed",
    ).length;
    return ART_TIERS.map((tier, index) => ({
      id: `${type}:${tier.completed}`,
      type,
      name: ART_NAMES[type],
      tier: index + 1,
      count,
      required: tier.completed,
      level: tier.level,
      unlocked: count >= tier.completed && currentLevel >= tier.level,
    }));
  });
}

export function effectiveProfileArt(
  selected: string,
  entries: LibraryEntry[],
  currentLevel: number,
): string {
  return completionAchievements(entries, currentLevel).some((a) => a.id === selected && a.unlocked)
    ? selected
    : "default";
}
