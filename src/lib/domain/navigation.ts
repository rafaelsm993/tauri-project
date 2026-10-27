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

export type HeaderScroll = { y: number; collapsed: boolean; travel?: number };

// Below this many px a scroll is jitter, not intent.
const JITTER_PX = 8;

// Whether the header should step aside, from the scroll position alone. Pure so the decision is
// testable without a layout: no element, no rAF, no measured geometry.
export function collapseOnScroll(prev: HeaderScroll, y: number): HeaderScroll {
  if (y <= 0) return { y: 0, collapsed: false, travel: 0 };
  const delta = y - prev.y;
  if (delta === 0) return prev;
  const previous = prev.travel ?? 0;
  const sum = Math.sign(previous) === Math.sign(delta) ? previous + delta : delta;
  const travel = Math.max(-JITTER_PX - 1, Math.min(JITTER_PX + 1, sum));
  return {
    y,
    travel,
    collapsed: Math.abs(travel) > JITTER_PX ? travel > 0 : prev.collapsed,
  };
}
