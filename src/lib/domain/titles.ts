import { TITLES, titleFor, type Title } from "./gamification";

export const earnedTitles = (level: number) => TITLES.filter((t) => t.level <= level);

export function displayedTitle(current: number, selected: string): Title {
  const automatic = titleFor(current);
  const chosen = earnedTitles(Math.max(1, current)).find((t) => t.name === selected);
  return { ...automatic, name: chosen?.name ?? automatic.name };
}
