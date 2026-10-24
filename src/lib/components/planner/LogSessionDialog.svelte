<script lang="ts">
  import { untrack } from "svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import { DEFAULT_PAGES_PER_HOUR } from "$lib/domain/estimate";
  import { unitLabel } from "$lib/domain/progress";
  import { defaultMinutes, logPreview } from "$lib/domain/sessionLog";
  import { libraryStore, type LibraryStore } from "$lib/stores/library.svelte";
  import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
  import { reminderStore } from "$lib/stores/reminders.svelte";
  import { formatDay, formatHours, formatMinutes, plural } from "$lib/utils/format";
  import type { LibraryEntry, Plan, UserData } from "$lib/types/library";

  // Confirms one session before saving it: how long it was, what it adds, what is left after.
  let {
    entry,
    today,
    dueMinutes,
    onclose,
    library = libraryStore,
    prefs = prefsStore,
    reminders = reminderStore,
  }: {
    // Planned: the card offers Log session only when `entry.user.plan` is set.
    entry: LibraryEntry;
    today: string;
    // Today's planned minutes when a session is due today; null otherwise.
    dueMinutes: number | null;
    onclose: () => void;
    library?: Pick<LibraryStore, "update" | "isPending" | "error">;
    prefs?: Pick<PrefsStore, "prefs">;
    reminders?: { logged: (key: string) => void };
  } = $props();

  const MAX_MINUTES = 720;
  const id = $props.id();

  const plan = $derived(entry.user.plan as Plan);
  const pace = $derived(prefs.prefs.reading_pages_per_hour ?? DEFAULT_PAGES_PER_HOUR);
  const type = $derived(entry.snapshot.media_type);

  let minutes = $state<number | null>(
    untrack(() =>
      defaultMinutes(
        entry,
        entry.user.plan as Plan,
        today,
        dueMinutes,
        prefs.prefs.reading_pages_per_hour ?? DEFAULT_PAGES_PER_HOUR,
      ),
    ),
  );
  let failure = $state("");

  const valid = $derived(minutes !== null && minutes > 0 && minutes <= MAX_MINUTES);
  const preview = $derived(valid ? logPreview(entry, plan, minutes as number, today, pace) : null);
  const busy = $derived(library.isPending(entry.key));
  const units = (n: number) => `${n} ${unitLabel(type, n)}`;

  const adds = $derived.by(() => {
    if (!preview) return "";
    if (type === "movie") return "Marks it watched";
    if (preview.gained === 0) return `+0 ${unitLabel(type, 0)}, still counts as today's session`;
    const of = preview.total === null ? "" : ` · ${preview.progress} of ${units(preview.total)}`;
    return `+${units(preview.gained)}${of}`;
  });

  const left = $derived.by(() => {
    if (!preview) return "";
    if (preview.finishes) return "Nothing left: this finishes it.";
    return `${plural(preview.sessionsLeft, "session")} · ${formatMinutes(preview.remainingMinutes)}`;
  });

  // Not due today: either the plan skips today, or today's session is already in.
  const disclaimer = $derived(
    dueMinutes !== null || !preview
      ? null
      : preview.plannedDay
        ? "You've already logged today's session. This one is extra."
        : "Today isn't one of the days you planned for this. It still counts, and the rest of the plan moves to fit.",
  );

  async function confirm() {
    if (!preview || busy) return;
    failure = "";
    const patch: Partial<UserData> = { progress: preview.progress };
    if (preview.status !== entry.user.status) patch.status = preview.status;
    if (!(await library.update(entry.key, patch))) {
      failure = library.error || "The session could not be saved.";
      return;
    }
    reminders.logged(entry.key);
    onclose();
  }
</script>

<Sheet label="Log a session of {entry.snapshot.title}" focus="sheet" {onclose}>
  <form
    class="log-sheet"
    onsubmit={(event) => {
      event.preventDefault();
      void confirm();
    }}
  >
    <h2 class="sheet-title">Log a session of {entry.snapshot.title}</h2>

    {#if disclaimer}
      <p class="log-note" role="note">{disclaimer}</p>
    {/if}

    <div class="sheet-block">
      <label class="field-label" for="{id}-minutes">Session length (minutes)</label>
      <div class="field-row">
        <input
          id="{id}-minutes"
          class="field-input"
          type="number"
          inputmode="numeric"
          min="1"
          max={MAX_MINUTES}
          step="1"
          bind:value={minutes}
          disabled={busy}
        />
        {#if preview}
          <span class="field-hours">
            {formatHours(minutes as number)} this session · {formatHours(preview.remainingMinutes)} left
          </span>
        {/if}
      </div>
      <p class="field-hint">Planned: {formatMinutes(plan.max_session_minutes)} per session</p>
    </div>

    {#if preview}
      <dl class="log-preview">
        <div>
          <dt>This session</dt>
          <dd>{adds}</dd>
        </div>
        <div>
          <dt>Still to go</dt>
          <dd>{left}</dd>
        </div>
        {#if preview.finish}
          <div>
            <dt>Finishes</dt>
            <dd>{formatDay(preview.finish)}</dd>
          </div>
        {/if}
      </dl>
    {/if}

    <div class="sheet-actions">
      <button type="submit" class="btn primary" disabled={!valid || busy}>Log session</button>
      <button type="button" class="btn ghost" onclick={onclose}>Cancel</button>
    </div>
    {#if failure}
      <p class="log-error" role="alert">⚠ {failure}</p>
    {/if}
  </form>
</Sheet>

<style lang="scss">
  // Same frame and controls as the plan sheet, so the two read as one family.
  .log-sheet {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    width: min(30rem, 100%);
    padding: $spacing-lg;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }

  .sheet-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
    overflow-wrap: anywhere;
  }

  .sheet-block {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }

  .field-label {
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .field-input {
    width: 6rem;
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    font-size: 0.85rem;
    font-family: inherit;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 1px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .field-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-xs $spacing-sm;
  }

  .field-hours {
    font-size: 0.85rem;
    color: var(--clr-text);
    font-variant-numeric: tabular-nums;
  }

  .field-hint {
    font-size: 0.78rem;
    color: var(--clr-text-2);
  }

  .log-note {
    font-size: 0.85rem;
    color: var(--clr-text-2);
    border-inline-start: 3px solid var(--clr-accent);
    padding-inline-start: $spacing-sm;
  }

  .log-preview {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    margin: 0;

    div {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0 $spacing-sm;
    }

    dt {
      font-size: 0.8rem;
      color: var(--clr-text-2);
    }

    dd {
      margin: 0;
      font-size: 0.9rem;
      color: var(--clr-text);
    }
  }

  .sheet-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .btn {
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.8rem;
    cursor: pointer;

    &.primary {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-on-primary);
      font-weight: 600;
    }

    &.ghost {
      color: var(--clr-text-2);
      border-color: transparent;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover:not(:disabled) {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
      padding-inline: $spacing-lg;
    }
  }

  .log-error {
    color: var(--clr-error);
    font-size: 0.8rem;
  }
</style>
