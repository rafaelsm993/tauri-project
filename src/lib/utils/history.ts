import type { AfterNavigate } from "@sveltejs/kit";

type Step = { type: AfterNavigate["type"]; delta?: number };

// How many in-app pages sit behind the current one; Back can only return to those.
export class InAppHistory {
  depth = 0;

  note({ type, delta }: Step): void {
    if (type === "enter") this.depth = 0;
    else if (type === "popstate") this.depth = Math.max(0, this.depth + (delta ?? 0));
    else this.depth += 1;
  }

  get canGoBack(): boolean {
    return this.depth > 0;
  }
}

export const inAppHistory = new InAppHistory();

// Returns to the previous in-app page, or runs `fallback` when the app was opened here.
export function goBack(
  fallback: () => void,
  history: InAppHistory = inAppHistory,
  back: () => void = () => window.history.back(),
): void {
  if (history.canGoBack) back();
  else fallback();
}
