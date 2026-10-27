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
  panelHeight?: number,
): { left: number; top: number; maxHeight: number } {
  const wanted = align === "start" ? trigger.left : trigger.right - width;
  const left = Math.max(EDGE, Math.min(Math.max(EDGE, wanted), viewport.width - width - EDGE));
  const below = Math.max(0, viewport.height - trigger.bottom - GAP - EDGE);
  if (panelHeight === undefined) {
    return { left, top: trigger.bottom + GAP, maxHeight: Math.max(MIN_HEIGHT, below) };
  }
  const above = Math.max(0, trigger.top - GAP - EDGE);
  const flip = below < Math.min(MIN_HEIGHT, panelHeight) && above > below;
  const maxHeight = flip ? above : below;
  const top = flip ? trigger.top - GAP - Math.min(panelHeight, maxHeight) : trigger.bottom + GAP;
  return { left, top: Math.max(EDGE, top), maxHeight };
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
  bounded = false,
): () => void {
  const place = () => {
    const p = placeBelow(
      trigger.getBoundingClientRect(),
      panel.offsetWidth,
      { width: window.innerWidth, height: window.innerHeight - safeBottom() },
      align,
      bounded ? panel.scrollHeight + panel.offsetHeight - panel.clientHeight : undefined,
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
