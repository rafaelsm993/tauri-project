import { localDay } from "$lib/domain/calendar";
import { DEFAULT_PAGES_PER_HOUR } from "$lib/domain/estimate";
import {
  shouldToast,
  SNOOZE_MS,
  todaySessions,
  type DueSession,
  type TodayPlan,
} from "$lib/domain/reminders";
import { gamificationStore } from "$lib/stores/gamification.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import { prefsStore } from "$lib/stores/prefs.svelte";
import type { LibraryEntry, LibraryEvent } from "$lib/types/library";

export interface ReminderDeps {
  library: {
    entries: LibraryEntry[];
    ready: boolean;
  };
  game: { history: LibraryEvent[]; ready: boolean; moment: unknown };
  pace: () => number;
  log: (message: string) => void;
}

const defaults: ReminderDeps = {
  library: libraryStore,
  game: gamificationStore,
  pace: () => prefsStore.prefs.reading_pages_per_hour ?? DEFAULT_PAGES_PER_HOUR,
  log: (message) => console.info(message),
};

// Today's planned sessions; checked on launch and focus only, never in the background.
export class ReminderStore {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- not UI state
  private toastedAt = new Map<string, number>();
  private snoozedUntil = 0;

  today = $state("");
  toast = $state<DueSession | null>(null);
  readonly data: TodayPlan;

  constructor(
    private deps: ReminderDeps = defaults,
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a fresh reading per call
    private clock: () => Date = () => new Date(),
  ) {
    this.today = localDay(clock());
    this.data = $derived(
      todaySessions(deps.library.entries, deps.game.history, this.today, deps.pace()),
    );
  }

  // A level-up owns the toast slot first.
  get visibleToast(): DueSession | null {
    return this.deps.game.moment ? null : this.toast;
  }

  check(): void {
    if (!this.deps.library.ready || !this.deps.game.ready) return;
    const at = this.clock();
    this.today = localDay(at);
    if (this.toast) return;
    const memory = { toastedAt: this.toastedAt, snoozedUntil: this.snoozedUntil };
    const next = shouldToast(this.data.due, memory, at.getTime());
    if (!next) return;
    this.toastedAt.set(next.entry.key, at.getTime());
    this.toast = next;
    this.deps.log(`[reminder] shown ${next.entry.key}`);
  }

  dismiss(): void {
    this.toast = null;
  }

  // A logged session made today's reminder for that item moot.
  logged(key: string): void {
    if (this.toast?.entry.key === key) this.toast = null;
  }

  later(): void {
    if (this.toast) this.deps.log(`[reminder] snoozed ${this.toast.entry.key}`);
    this.snoozedUntil = this.clock().getTime() + SNOOZE_MS;
    this.toast = null;
  }
}

export const reminderStore = new ReminderStore();
