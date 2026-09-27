import { library as defaultLibrary } from "$lib/api/library";
import {
  activeDays,
  awards,
  celebration,
  levelOf,
  savedLengths,
  streaks,
  titleFor,
  totalXp,
  type Moment,
} from "$lib/domain/gamification";
import {
  activityByDay,
  backlog,
  familyBreakdown,
  FAMILIES,
  nextLevelEta,
  pace,
  statusCounts,
  xpByWeek,
} from "$lib/domain/dashboard";
import { libraryStore } from "$lib/stores/library.svelte";
import { prefsStore } from "$lib/stores/prefs.svelte";
import { errorMessage } from "$lib/utils/errors";
import type { LibraryEntry, LibraryEvent } from "$lib/types/library";

export type EventsClient = {
  events: () => Promise<LibraryEvent[]>;
  onEvent?: (fn: (event: LibraryEvent) => void) => () => void;
};

// The last level congratulated; `null` until it is known.
export type SeenLevel = { get: () => number | null; set: (level: number) => Promise<void> };

const seenInPrefs: SeenLevel = {
  get: () => (prefsStore.ready ? prefsStore.prefs.seen_level : null),
  set: (level) => prefsStore.update({ seen_level: level }),
};

// The loaded log first, then saves heard meanwhile that it does not have yet.
function mergeById(log: LibraryEvent[], extra: LibraryEvent[]): LibraryEvent[] {
  const ids = new Set(log.map((e) => e.id));
  return [...log, ...extra.filter((e) => !ids.has(e.id))];
}

const localToday = (): string => new Date().toLocaleDateString("en-CA");

// e2e fakes answer unknown commands with junk; only a list is a log.
const asLog = (raw: unknown): LibraryEvent[] => (Array.isArray(raw) ? raw : []);

// Everything the profile shows, derived from the activity log and the library.
export class GamificationStore {
  private client: EventsClient;
  private entriesOf: () => LibraryEntry[];
  private todayOf: () => string;
  private seen: SeenLevel;
  // One queue per load in flight; only the newest load's answer is kept.
  private queues: LibraryEvent[][] = [];
  private loads = 0;
  // Highest level congratulated this session; survives a failed or stale settings write.
  private celebrated = 0;

  events = $state<LibraryEvent[]>([]);
  moment = $state<Moment | null>(null);
  burst = $state(false);
  today = $state("");
  ready = $state(false);
  error = $state("");

  entries = $derived.by(() => this.entriesOf());
  awards = $derived(awards(this.events, savedLengths(this.entries)));
  xp = $derived(totalXp(this.awards));
  level = $derived(levelOf(this.xp));
  title = $derived(titleFor(this.level.level));
  streak = $derived(streaks(activeDays(this.events), this.today));
  statuses = $derived(statusCounts(this.entries));
  families = $derived(familyBreakdown(this.entries));
  backlog = $derived(backlog(this.entries));
  pace = $derived(pace(this.awards, this.today));
  eta = $derived(nextLevelEta(this.level.needed - this.level.into, this.pace));
  isEmpty = $derived(this.events.length === 0 && this.entries.length === 0);
  libraryEmpty = $derived(this.entries.length === 0);
  weeks = $derived(xpByWeek(this.awards, this.today));
  activity = $derived(activityByDay(this.events));
  hours = $derived(FAMILIES.reduce((sum, f) => sum + this.families[f].hours, 0));

  constructor(
    client: EventsClient = defaultLibrary,
    entries: () => LibraryEntry[] = () => libraryStore.entries,
    today: () => string = localToday,
    seen: SeenLevel = seenInPrefs,
  ) {
    this.client = client;
    this.entriesOf = entries;
    this.todayOf = today;
    this.seen = seen;
    this.today = today();
    client.onEvent?.((e) => this.record(e));
  }

  // A save elsewhere in the app; while the log loads it waits to be merged.
  record(event: LibraryEvent): void {
    for (const queue of this.queues) queue.push(event);
    if (this.events.some((e) => e.id === event.id)) return;
    this.events = [...this.events, event];
    this.check();
  }

  dismiss(): void {
    this.moment = null;
    this.burst = false;
  }

  burstDone(): void {
    this.burst = false;
  }

  // Congratulates a level above the highest one seen; `quiet` (imports) adopts the level as is.
  check(quiet = false): void {
    const saved = this.seen.get();
    if (!this.ready || saved === null) return;
    const level = this.level.level;
    const mark = Math.max(saved, this.celebrated);
    const next = quiet ? { show: null, seen: level } : celebration(mark, level);
    if (!quiet && next.seen < mark) return;
    this.celebrated = next.seen;
    if (next.seen !== saved) this.remember(next.seen);
    if (!next.show) return;
    this.moment = next.show;
    this.burst = true;
  }

  private remember(level: number): void {
    this.seen.set(level).catch((e) => console.warn("[gamification] could not save the level", e));
  }

  // "Today" moves at midnight even with the app left open; the log itself is unchanged.
  refreshDay(): void {
    const day = this.todayOf();
    if (day !== this.today) this.today = day;
  }

  // Read on every visit: cheap, and an import or a save elsewhere is always reflected.
  async load({ quiet = false }: { quiet?: boolean } = {}): Promise<void> {
    this.error = "";
    this.today = this.todayOf();
    const id = ++this.loads;
    const heard: LibraryEvent[] = [];
    this.queues.push(heard);
    try {
      const log = asLog(await this.client.events());
      if (id !== this.loads) return;
      this.events = mergeById(log, heard);
      this.ready = true;
    } catch (e) {
      if (id !== this.loads) return;
      this.error = errorMessage(e, "Failed to read your activity.");
    } finally {
      this.queues = this.queues.filter((q) => q !== heard);
    }
    this.check(quiet);
  }
}

export const gamificationStore = new GamificationStore();
