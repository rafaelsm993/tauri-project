import { MediaQuery } from "svelte/reactivity";
import { prefsStore, PrefsStore } from "./prefs.svelte";

const REDUCE = "prefers-reduced-motion: reduce";

type Query = { readonly current: boolean };

// Where matchMedia is missing (old test DOMs), nobody asked for reduced motion.
function systemQuery(): Query {
  return typeof window.matchMedia === "function" ? new MediaQuery(REDUCE) : { current: false };
}

// The one answer to "may this animate?": the saved setting, overruled by the system's reduce-motion.
export class MotionStore {
  constructor(
    private prefs: PrefsStore = prefsStore,
    private system: Query = systemQuery(),
  ) {}

  get reduced(): boolean {
    return this.system.current;
  }

  get on(): boolean {
    return this.prefs.ready && this.prefs.prefs.motion && !this.reduced;
  }
}

export const motionStore = new MotionStore();
