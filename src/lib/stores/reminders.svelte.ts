import { addDays, localDay } from "$lib/domain/calendar";
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
import type { LibraryEntry, LibraryEvent, Plan } from "$lib/types/library";
import type { MediaKey } from "$lib/types/media";

export interface ReminderDeps {
  library: {
    entries: LibraryEntry[];
    ready: boolean;
    error: string;
    plan: (key: MediaKey, plan: Plan | null) => Promise<boolean>;
  };
  game: { events: LibraryEvent[]; ready: boolean; moment: unknown };
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
  private saving = $state<string[]>([]);

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
      todaySessions(deps.library.entries, deps.game.events, this.today, deps.pace()),
    );
  }

  // A level-up owns the toast slot first.
  get visibleToast(): DueSession | null {
    return this.deps.game.moment ? null : this.toast;
  }

  busy(key: string): boolean {
    return this.saving.includes(key);
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

  later(): void {
    if (this.toast) this.deps.log(`[reminder] snoozed ${this.toast.entry.key}`);
    this.snoozedUntil = this.clock().getTime() + SNOOZE_MS;
    this.toast = null;
  }

  done(key: string): Promise<void> {
    return this.resumeTomorrow(key, "done");
  }

  nextSession(key: string): Promise<void> {
    return this.resumeTomorrow(key, "next session");
  }

  private async resumeTomorrow(key: string, action: string): Promise<void> {
    const { library } = this.deps;
    const plan = library.entries.find((e) => e.key === key)?.user.plan;
    if (!plan || this.busy(key)) return;
    this.saving = [...this.saving, key];
    const saved = await library
      .plan(key, { ...plan, since: addDays(this.today, 1) })
      .finally(() => {
        this.saving = this.saving.filter((k) => k !== key);
      });
    if (!saved) return;
    if (this.toast?.entry.key === key) this.toast = null;
    this.deps.log(`[reminder] ${action} ${key}`);
  }
}

export const reminderStore = new ReminderStore();
