<script lang="ts">
  import { untrack } from "svelte";
  import LengthFields from "./LengthFields.svelte";
  import { DEFAULT_PAGES_PER_HOUR } from "$lib/domain/estimate";
  import { LENGTH_LABELS, missingLengthFields } from "$lib/domain/length";
  import { finishShift, planFor } from "$lib/domain/planner";
  import { formatDay, formatMinutes, plural } from "$lib/utils/format";
  import type { Length, LibraryEntry, Plan } from "$lib/types/library";

  export interface PlanSave {
    plan: Plan;
    // The completed length when fields were missing; null when nothing changed.
    length: Length | null;
    // The reading pace when it was asked now; null otherwise.
    pagesPerHour: number | null;
  }

  let {
    entry,
    today,
    pagesPerHour,
    busy = false,
    onsave,
    onclear,
    oncancel,
  }: {
    entry: LibraryEntry;
    today: string;
    pagesPerHour: number | null;
    busy?: boolean;
    onsave: (value: PlanSave) => void;
    onclear: () => void;
    oncancel: () => void;
  } = $props();

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const PRESETS = [15, 30, 45, 60, 90, 120];
  const MIN_SESSION = 5;
  const MAX_SESSION = 720;

  const id = $props.id();
  const type = $derived(entry.snapshot.media_type);
  const existing = $derived(entry.user.plan);

  // Local copies, so editing never touches the saved entry until Save.
  let days = $state<number[]>(untrack(() => [...(entry.user.plan?.days ?? [])]));
  let minutes = $state(untrack(() => entry.user.plan?.max_session_minutes ?? 60));
  let custom = $state(untrack(() => !PRESETS.includes(entry.user.plan?.max_session_minutes ?? 60)));
  let draft = $state<Length>(untrack(() => ({ ...entry.user.length })));
  let pace = $state(untrack(() => pagesPerHour ?? DEFAULT_PAGES_PER_HOUR));

  const askedFields = untrack(() =>
    missingLengthFields(entry.snapshot.media_type, entry.user.length),
  );
  const asksPace = $derived(type === "book" && pagesPerHour === null);
  const usedPace = $derived(asksPace ? pace : (pagesPerHour ?? DEFAULT_PAGES_PER_HOUR));

  const sessionOk = $derived(
    Number.isInteger(minutes) && minutes >= MIN_SESSION && minutes <= MAX_SESSION,
  );
  const paceOk = $derived(!asksPace || (Number.isInteger(pace) && pace >= 5 && pace <= 300));
  const plan = $derived<Plan>({
    days: [...days].sort(),
    max_session_minutes: minutes,
    since: today,
  });
  const withLength = $derived({ ...entry, user: { ...entry.user, length: draft } });
  const preview = $derived(
    days.length > 0 && sessionOk && paceOk ? planFor(withLength, plan, today, usedPace) : null,
  );
  const before = $derived(existing ? planFor(entry, existing, today, usedPace) : null);
  const shift = $derived(
    preview?.kind === "planned" && before?.kind === "planned"
      ? finishShift(before.finish, preview.finish)
      : null,
  );
  const canSave = $derived(!busy && preview !== null && preview.kind === "planned");

  const summary = $derived.by(() => {
    if (preview?.kind !== "planned") return "";
    const n = preview.sessions.length;
    const avg = Math.round(preview.sessions.reduce((s, x) => s + x.minutes, 0) / n);
    return `${plural(n, "session")} of about ${formatMinutes(avg)} · finishes ${formatDay(preview.finish)}`;
  });

  const shiftText = $derived.by(() => {
    if (!shift) return "";
    if (shift.dir === "same") return "Same finish date as before.";
    return `Finishes ${plural(shift.days, "day")} ${shift.dir} than before.`;
  });

  function toggle(day: number) {
    days = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
  }

  function pick(value: number) {
    custom = false;
    minutes = value;
  }

  function readInt(event: Event): number {
    const raw = (event.currentTarget as HTMLInputElement).value;
    return raw === "" ? NaN : Number(raw);
  }

  function save() {
    if (!canSave) return;
    const lengthChanged = askedFields.length > 0;
    onsave({
      plan,
      length: lengthChanged ? { ...draft } : null,
      pagesPerHour: asksPace ? pace : null,
    });
  }
</script>

<div class="plan-sheet">
  <h2 class="sheet-title">Plan {entry.snapshot.title}</h2>

  {#if askedFields.length > 0}
    <div class="sheet-block">
      <p class="sheet-hint">Needed to plan it: how long it is.</p>
      <LengthFields fields={askedFields} bind:length={draft} disabled={busy} />
    </div>
  {/if}

  {#if type === "book"}
    {#if asksPace}
      <div class="sheet-block">
        <label class="field-label" for="{id}-pace">Pages per hour</label>
        <input
          id="{id}-pace"
          class="field-input"
          type="number"
          min="5"
          max="300"
          step="1"
          inputmode="numeric"
          value={pace}
          disabled={busy}
          oninput={(event) => (pace = readInt(event))}
        />
        <p class="sheet-hint">Asked once and kept for every book.</p>
      </div>
    {:else}
      <p class="sheet-hint">At {pagesPerHour} pages an hour.</p>
    {/if}
  {/if}

  <div class="sheet-block">
    <span class="field-label" id="{id}-days">Days</span>
    <div class="chips" role="group" aria-labelledby="{id}-days">
      {#each DAYS as name, i (name)}
        <button
          type="button"
          class="chip"
          class:active={days.includes(i)}
          aria-pressed={days.includes(i)}
          disabled={busy}
          onclick={() => toggle(i)}
        >
          {name}
        </button>
      {/each}
    </div>
  </div>

  <div class="sheet-block">
    <span class="field-label" id="{id}-session">Up to, per session</span>
    <div class="chips" role="group" aria-labelledby="{id}-session">
      {#each PRESETS as value (value)}
        <button
          type="button"
          class="chip"
          class:active={!custom && minutes === value}
          aria-pressed={!custom && minutes === value}
          disabled={busy}
          onclick={() => pick(value)}
        >
          {formatMinutes(value)}
        </button>
      {/each}
      <button
        type="button"
        class="chip"
        class:active={custom}
        aria-pressed={custom}
        disabled={busy}
        onclick={() => (custom = true)}
      >
        Custom
      </button>
    </div>
    {#if custom}
      <label class="field-label" for="{id}-minutes">Minutes per session (5–720)</label>
      <input
        id="{id}-minutes"
        class="field-input"
        type="number"
        min={MIN_SESSION}
        max={MAX_SESSION}
        step="1"
        inputmode="numeric"
        value={Number.isFinite(minutes) ? minutes : ""}
        disabled={busy}
        oninput={(event) => (minutes = readInt(event))}
      />
    {/if}
  </div>

  <div class="preview" aria-live="polite">
    {#if summary}
      <p class="preview-main">{summary}</p>
      {#if shiftText}
        <p class="preview-shift">{shiftText}</p>
      {/if}
    {:else if preview?.kind === "done"}
      <p class="preview-main">Nothing left to plan.</p>
    {:else if days.length === 0}
      <p class="sheet-hint">Pick the days you have time.</p>
    {:else if preview?.kind === "needs"}
      <p class="sheet-hint">
        Add {preview.missing.map((f) => LENGTH_LABELS[f].toLowerCase()).join(" and ")} to see the plan.
      </p>
    {/if}
  </div>

  <div class="sheet-actions">
    <button type="button" class="btn primary" disabled={!canSave} onclick={save}>Save plan</button>
    {#if existing}
      <button type="button" class="btn" disabled={busy} onclick={onclear}>Stop planning</button>
    {/if}
    <button type="button" class="btn ghost" disabled={busy} onclick={oncancel}>Cancel</button>
  </div>
</div>

<style lang="scss">
  .plan-sheet {
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

  .sheet-hint {
    font-size: 0.8rem;
    color: var(--clr-text-3);
  }

  .field-label {
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .field-input {
    width: 100%;
    max-width: 10rem;
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

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
  }

  .chip {
    min-width: 2.75rem;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text-2);
    font-size: 0.8rem;
    cursor: pointer;

    &.active {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-text);
      font-weight: 600;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    @include hover-capable {
      &:hover:not(:disabled, .active) {
        border-color: var(--clr-accent);
        color: var(--clr-text);
      }
    }

    @include touch {
      min-height: $touch-target;
      min-width: $touch-target;
    }
  }

  .preview {
    min-height: 2.5rem;
  }

  .preview-main {
    font-size: 0.9rem;
    color: var(--clr-text);
  }

  .preview-shift {
    font-size: 0.8rem;
    color: var(--clr-text-2);
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
</style>
