const GAP = 6;
const EDGE = 8;
const MIN_HEIGHT = 160;

export type Align = "start" | "end";

// Where a panel of `width` goes under `trigger`: aligned to its right (or left) edge, clamped inside the viewport.
export function placeBelow(
  trigger: DOMRect,
  width: number,
  viewport: { width: number; height: number },
  align: Align = "end",
): { left: number; top: number; maxHeight: number } {
  const wanted = align === "start" ? trigger.left : trigger.right - width;
  const left = Math.min(Math.max(EDGE, wanted), viewport.width - width - EDGE);
  const top = trigger.bottom + GAP;
  return {
    left: Math.max(EDGE, left),
    top,
    maxHeight: Math.max(MIN_HEIGHT, viewport.height - top - EDGE),
  };
}

// What the system draws over the bottom of the window (Android's navigation bar); 0 elsewhere.
function safeBottom(): number {
  return (
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom")) || 0
  );
}

// Re-places `panel` under `trigger` now and on resize/scroll; returns a stop fn.
export function followTrigger(
  trigger: HTMLElement,
  panel: HTMLElement,
  align: Align = "end",
): () => void {
  const place = () => {
    const p = placeBelow(
      trigger.getBoundingClientRect(),
      panel.offsetWidth,
      { width: window.innerWidth, height: window.innerHeight - safeBottom() },
      align,
    );
    panel.style.left = `${p.left}px`;
    panel.style.top = `${p.top}px`;
    panel.style.maxHeight = `${p.maxHeight}px`;
  };
  place();
  window.addEventListener("resize", place);
  window.addEventListener("scroll", place, { capture: true, passive: true });
  return () => {
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, { capture: true });
  };
}
