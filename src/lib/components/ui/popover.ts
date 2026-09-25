const GAP = 6;
const EDGE = 8;
const MIN_HEIGHT = 160;

// Where a panel of `width` goes under `trigger`: right-aligned, clamped inside the viewport.
export function placeBelow(
  trigger: DOMRect,
  width: number,
  viewport: { width: number; height: number },
): { left: number; top: number; maxHeight: number } {
  const left = Math.min(Math.max(EDGE, trigger.right - width), viewport.width - width - EDGE);
  const top = trigger.bottom + GAP;
  return {
    left: Math.max(EDGE, left),
    top,
    maxHeight: Math.max(MIN_HEIGHT, viewport.height - top - EDGE),
  };
}

// Re-places `panel` under `trigger` now and on resize/scroll; returns a stop fn.
export function followTrigger(trigger: HTMLElement, panel: HTMLElement): () => void {
  const place = () => {
    const p = placeBelow(trigger.getBoundingClientRect(), panel.offsetWidth, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
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
