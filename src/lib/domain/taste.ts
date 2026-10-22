import { FAMILIES, type Family } from "./dashboard";
import type { MediaType } from "$lib/types/media";

// The types each family covers; `screen` is the one that holds two.
const TYPES: Record<Family, MediaType[]> = {
  screen: ["movie", "tv"],
  anime: ["anime"],
  manga: ["manga"],
  book: ["book"],
  game: ["game"],
};

const isFamily = (v: string): v is Family => (FAMILIES as readonly string[]).includes(v);

// The media types behind a saved taste pick, in the order the user picked.
export function typesFor(families: string[]): MediaType[] {
  return families.filter(isFamily).flatMap((f) => TYPES[f]);
}

// Which category the home screen opens on; the first pick, else the default.
export function firstCategory(families: string[]): MediaType {
  return typesFor(families)[0] ?? "movie";
}
