export type Section = "home" | "library" | "planner" | "profile" | "settings";

const SECTIONS: Section[] = ["library", "planner", "profile", "settings"];

// Which tab a path belongs to; a detail page stays with the section it was opened from.
export function sectionOf(path: string, last: Section | null): Section | null {
  const first = path.split("/").filter(Boolean)[0];
  if (first === undefined) return "home";
  if (first === "media") return last ?? "home";
  return SECTIONS.find((s) => s === first) ?? null;
}
