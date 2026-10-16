type Place = {
  route: { id: string | null };
  params: Partial<Record<string, string>> | null;
} | null;

type Navigation = { from: Place; to: Place; complete: Promise<void> };

type Doc = Pick<Document, "querySelectorAll"> & {
  startViewTransition?: (update: () => Promise<void>) => {
    finished: Promise<void>;
    skipTransition(): void;
  };
};

const DETAIL = "/media/[type]/[id]";
const NAME = "poster";
const WAIT_MS = 300;

// The `data-poster` value shared by a card's image and the detail hero of the same item.
export const posterKey = (type: string, id: string) => `${type}/${id}`;

// The item whose poster should carry over: the detail page being opened, or the one being left.
export function morphKey({ from, to }: Pick<Navigation, "from" | "to">): string | null {
  for (const place of [to, from]) {
    if (place?.route.id === DETAIL)
      return posterKey(place.params?.type ?? "", place.params?.id ?? "");
  }
  return null;
}

// The on-screen element for a key; several cards can show the same item.
function find(doc: Doc, key: string): HTMLElement | null {
  const all = [...doc.querySelectorAll<HTMLElement>("[data-poster]")].filter(
    (el) => el.dataset.poster === key,
  );
  const visible = all.find((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  });
  return visible ?? all[0] ?? null;
}

// The closest ancestor that may skip drawing itself off-screen, which would leave nothing to capture.
function skipper(el: HTMLElement): HTMLElement | null {
  for (let at = el.parentElement; at; at = at.parentElement) {
    const value = at.style.contentVisibility || getComputedStyle(at).contentVisibility;
    if (value === "auto") return at;
  }
  return null;
}

// Names the element, draws it even off-screen, and shows it whole if it was still fading in.
function hold(el: HTMLElement | null) {
  if (!el) return;
  el.style.viewTransitionName = NAME;
  el.style.opacity = "1";
  el.style.transition = "none";
  const box = skipper(el);
  if (box) {
    box.dataset.morphShown = box.style.contentVisibility;
    box.style.contentVisibility = "visible";
  }
}

function release(el: HTMLElement | null) {
  if (!el) return;
  el.style.viewTransitionName = "";
  el.style.opacity = "";
  el.style.transition = "";
  const box = el.closest<HTMLElement>("[data-morph-shown]");
  if (box) {
    box.style.contentVisibility = box.dataset.morphShown ?? "";
    delete box.dataset.morphShown;
  }
}

// A timer, not an animation frame: the engine pauses rendering while it waits for the new page.
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 16));

// The new page may render its poster a moment after navigating; waits briefly, then gives up.
async function arrival(doc: Doc, key: string): Promise<HTMLElement | null> {
  const until = performance.now() + WAIT_MS;
  let el = find(doc, key);
  while (!el && performance.now() < until) {
    await tick();
    el = find(doc, key);
  }
  if (el instanceof HTMLImageElement && el.decode) {
    await Promise.race([el.decode().catch(() => {}), new Promise((r) => setTimeout(r, WAIT_MS))]);
  }
  return el;
}

let running: { skipTransition(): void } | null = null;

// Morphs the poster between a card and the detail page, both ways, when the engine can and motion is on.
export function startTransition(
  navigation: Navigation,
  { motion, doc }: { motion: boolean; doc: Doc },
): Promise<void> | undefined {
  running?.skipTransition();
  running = null;
  const key = morphKey(navigation);
  if (!motion || !doc.startViewTransition || !key) return;
  let held = find(doc, key);
  if (!held) return;
  hold(held);
  return new Promise((resolve) => {
    const transition = doc.startViewTransition!(async () => {
      resolve();
      await navigation.complete;
      release(held);
      held = await arrival(doc, key);
      hold(held);
    });
    running = transition;
    void transition.finished.finally(() => {
      release(held);
      if (running === transition) running = null;
    });
  });
}
