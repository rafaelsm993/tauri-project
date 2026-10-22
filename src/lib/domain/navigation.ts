export type Section = "home" | "library" | "planner" | "profile" | "settings";

const SECTIONS: Section[] = ["library", "planner", "profile", "settings"];

// Which tab a path belongs to; a detail page stays with the section it was opened from.
export function sectionOf(path: string, last: Section | null): Section | null {
  const first = path.split("/").filter(Boolean)[0];
  if (first === undefined) return "home";
  if (first === "media") return last ?? "home";
  return SECTIONS.find((s) => s === first) ?? null;
}

type Span = { left: number; right: number };

// How far a scrolling rail must move to bring a tab into view; 0 when it already is.
// A tab wider than the rail aligns to its left edge, where the label starts.
export function shouldReveal(rail: Span, tab: Span): number {
  if (tab.left < rail.left) return tab.left - rail.left;
  if (tab.right > rail.right) {
    const overhang = tab.right - rail.right;
    const available = tab.left - rail.left;
    return Math.min(overhang, available);
  }
  return 0;
}
