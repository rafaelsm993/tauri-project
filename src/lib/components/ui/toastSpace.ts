// Space at the bottom of the screen that open toasts cover; the app shell pads by the tallest.
const held = new Map<string, number>();

function publish() {
  const style = document.documentElement.style;
  if (held.size === 0) style.removeProperty("--toast-covered");
  else style.setProperty("--toast-covered", `${Math.max(...held.values())}px`);
}

export function reserve(id: string, px: number): void {
  held.set(id, px);
  publish();
}

export function release(id: string): void {
  if (held.delete(id)) publish();
}
