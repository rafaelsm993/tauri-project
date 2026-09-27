import { library as defaultLibrary } from "$lib/api/library";
import { activeDays, awards, levelOf, streaks, titleFor, totalXp } from "$lib/domain/gamification";
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
import { errorMessage } from "$lib/utils/errors";
import type { LibraryEntry, LibraryEvent } from "$lib/types/library";

export type EventsClient = { events: () => Promise<LibraryEvent[]> };

const localToday = (): string => new Date().toLocaleDateString("en-CA");

// e2e fakes answer unknown commands with junk; only a list is a log.
const asLog = (raw: unknown): LibraryEvent[] => (Array.isArray(raw) ? raw : []);

// Everything the profile shows, derived from the activity log and the library.
export class GamificationStore {
  private client: EventsClient;
  private entriesOf: () => LibraryEntry[];
  private todayOf: () => string;

  events = $state<LibraryEvent[]>([]);
  today = $state("");
  ready = $state(false);
  error = $state("");

  awards = $derived(awards(this.events));
  xp = $derived(totalXp(this.awards));
  level = $derived(levelOf(this.xp));
  title = $derived(titleFor(this.level.level));
  streak = $derived(streaks(activeDays(this.events), this.today));
  entries = $derived.by(() => this.entriesOf());
  statuses = $derived(statusCounts(this.entries));
  families = $derived(familyBreakdown(this.entries));
  backlog = $derived(backlog(this.entries));
  pace = $derived(pace(this.awards, this.today));
  eta = $derived(nextLevelEta(this.level.needed - this.level.into, this.pace));
  isEmpty = $derived(this.events.length === 0 && this.entries.length === 0);
  weeks = $derived(xpByWeek(this.awards, this.today));
  activity = $derived(activityByDay(this.events));
  hours = $derived(FAMILIES.reduce((sum, f) => sum + this.families[f].hours, 0));

  constructor(
    client: EventsClient = defaultLibrary,
    entries: () => LibraryEntry[] = () => libraryStore.entries,
    today: () => string = localToday,
  ) {
    this.client = client;
    this.entriesOf = entries;
    this.todayOf = today;
    this.today = today();
  }

  // Read on every visit: cheap, and an import or a save elsewhere is always reflected.
  async load(): Promise<void> {
    this.error = "";
    this.today = this.todayOf();
    try {
      this.events = asLog(await this.client.events());
      this.ready = true;
    } catch (e) {
      this.error = errorMessage(e, "Failed to read your activity.");
    }
  }
}

export const gamificationStore = new GamificationStore();
