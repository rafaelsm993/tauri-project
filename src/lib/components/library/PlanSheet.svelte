<script lang="ts">
  import { untrack } from "svelte";
  import LengthFields from "./LengthFields.svelte";
  import LengthNote from "./LengthNote.svelte";
  import { DEFAULT_PAGES_PER_HOUR } from "$lib/domain/estimate";
  import {
    LENGTH_LABELS,
    fillMissing,
    lengthGapNote,
    missingLengthFields,
    resolveTotal,
  } from "$lib/domain/length";
  import { finishShift, planFor } from "$lib/domain/planner";
  import { fullSession } from "$lib/domain/sessionLog";
  import { formatDay, formatMinutes, plural } from "$lib/utils/format";
  import type { Length, LibraryEntry, Plan } from "$lib/types/library";
  import { PROVIDER_LABELS } from "$lib/types/media";

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
    chapterMinutes = null,
    found = null,
    busy = false,
    onsave,
    onclear,
    oncancel,
  }: {
    entry: LibraryEntry;
    today: string;
    pagesPerHour: number | null;
    // The Settings default for a manga's minutes per chapter; null when unset.
    chapterMinutes?: number | null;
    // What the catalog knows of the length; fills only fields the saved entry lacks.
    found?: Length | null;
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
  // Missing fields start from the catalog, then a manga's minutes from the Settings default.
  let draft = $state<Length>(
    untrack(() => {
      const length = found ? fillMissing(entry.user.length, found) : { ...entry.user.length };
      if (entry.snapshot.media_type === "manga" && !length.chapter_minutes && chapterMinutes)
        length.chapter_minutes = chapterMinutes;
      return length;
    }),
  );
  // A new plan follows one whole unit once its minutes are known; an existing one only if it is one.
  const startFull = untrack(() => {
    if (!entry.user.plan) return true;
    return entry.user.plan.max_session_minutes === fullSession(entry)?.minutes;
  });
  let minutes = $state(untrack(() => entry.user.plan?.max_session_minutes ?? 60));
  // Picking a preset or Custom turns it off.
  let fullPicked = $state(startFull);
  // Shows and anime plan whole episodes; an existing plan that isn't whole episodes opens on Custom.
  const episodic = untrack(
    () => entry.snapshot.media_type === "tv" || entry.snapshot.media_type === "anime",
  );
  const opened = untrack(() => {
    const per = fullSession(entry)?.minutes;
    const saved = entry.user.plan?.max_session_minutes;
    if (!per || !saved || saved < per) return { episodes: 1, custom: false };
    return saved % per === 0
      ? { episodes: saved / per, custom: false }
      : { episodes: 1, custom: true };
  });
  let episodes = $state(opened.episodes);
  let custom = $state(
    untrack(() =>
      episodic
        ? opened.custom
        : !startFull && !PRESETS.includes(entry.user.plan?.max_session_minutes ?? 60),
    ),
  );
  let pace = $state(untrack(() => pagesPerHour ?? DEFAULT_PAGES_PER_HOUR));

  const askedFields = untrack(() =>
    missingLengthFields(entry.snapshot.media_type, entry.user.length),
  );
  const fromCatalog = untrack(() => askedFields.some((field) => found?.[field] != null));
  // Asked of the catalog and still unknown; empty when the catalog was never asked.
  const gap = untrack(() => (found ? askedFields.filter((field) => draft[field] === null) : []));
  const asksPace = $derived(type === "book" && pagesPerHour === null);
  const usedPace = $derived(type === "book" ? pace : (pagesPerHour ?? DEFAULT_PAGES_PER_HOUR));

  const withLength = $derived({ ...entry, user: { ...entry.user, length: draft } });
  const full = $derived.by(() => {
    const f = fullSession(withLength);
    return f && f.minutes >= MIN_SESSION && f.minutes <= MAX_SESSION ? f : null;
  });
  const fullOn = $derived(fullPicked && full !== null);
  // Whole episodes around Full episode: at least one, at most 12 h of them or what is left.
  const stepper = $derived(episodic && full !== null);
  const waitsForMinutes = $derived(episodic && !draft.episode_minutes);
  const left = $derived.by(() => {
    const total = resolveTotal(type, null, draft);
    return total === null ? Infinity : total - entry.user.progress;
  });
  const maxEpisodes = $derived(
    full ? Math.max(1, Math.min(Math.floor(MAX_SESSION / full.minutes), left)) : 1,
  );
  const count = $derived(Math.min(episodes, maxEpisodes));
  // The shortest session allowed: one episode for shows, else the global floor.
  const floor = $derived(stepper && full ? full.minutes : MIN_SESSION);
  // What gets previewed and saved.
  const session = $derived(
    stepper && full
      ? custom
        ? minutes
        : count * full.minutes
      : fullOn && full
        ? full.minutes
        : minutes,
  );

  const sessionOk = $derived(
    Number.isInteger(session) && session >= floor && session <= MAX_SESSION,
  );
  const paceOk = $derived(type !== "book" || (Number.isInteger(pace) && pace >= 5 && pace <= 300));
  const plan = $derived<Plan>({
    days: [...days].sort(),
    max_session_minutes: session,
    since: today,
  });
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

  function step(to: number) {
    custom = false;
    episodes = to;
  }

  // Custom starts from the episodes on screen, not a stale default.
  function pickCustom(perEpisode: number) {
    custom = true;
    minutes = count * perEpisode;
  }

  function pick(value: number) {
    custom = false;
    fullPicked = false;
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
      pagesPerHour: type === "book" && pace !== pagesPerHour ? pace : null,
    });
  }
</script>

<div class="plan-sheet">
  <h2 class="sheet-title">Plan {entry.snapshot.title}</h2>

  {#if askedFields.length > 0}
    <div class="sheet-block">
      {#if gap.length > 0}
        <LengthNote
          text={lengthGapNote(PROVIDER_LABELS[entry.snapshot.provider], entry.snapshot.title, gap)}
        />
      {:else}
        <p class="sheet-hint">
          Needed to plan it: how long it is.
          {#if fromCatalog}
            Filled in from {PROVIDER_LABELS[entry.snapshot.provider]}; change it if it is off.
          {/if}
        </p>
      {/if}
      <LengthFields
        fields={askedFields}
        bind:length={draft}
        mediaType={entry.snapshot.media_type}
        disabled={busy}
        required
      />
    </div>
  {/if}

  {#if type === "book"}
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
      <p class="sheet-hint">
        {asksPace
          ? "Asked once and kept for every book."
          : "Kept for every book. Also in Settings."}
      </p>
    </div>
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
    {#if stepper && full}
      <div class="stepper" role="group" aria-labelledby="{id}-session">
        <button
          type="button"
          class="step"
          aria-label="Fewer episodes"
          disabled={busy || count <= 1}
          onclick={() => step(count - 1)}>‹</button
        >
        <button
          type="button"
          class="step-value"
          class:active={!custom}
          aria-pressed={!custom}
          disabled={busy}
          onclick={() => step(1)}
        >
          <span class="step-title">{count === 1 ? full.label : plural(count, "episode")}</span>
          <span class="step-minutes">{formatMinutes(count * full.minutes)}</span>
        </button>
        <button
          type="button"
          class="step"
          aria-label="More episodes"
          disabled={busy || count >= maxEpisodes}
          onclick={() => step(count + 1)}>›</button
        >
        <button
          type="button"
          class="step-custom"
          class:active={custom}
          aria-pressed={custom}
          disabled={busy}
          onclick={() => pickCustom(full.minutes)}>Custom</button
        >
      </div>
    {:else if waitsForMinutes}
      <p class="sheet-hint">Add the minutes per episode above to pick a session.</p>
    {:else}
      <div class="chips" role="group" aria-labelledby="{id}-session">
        {#if full}
          <button
            type="button"
            class="chip"
            class:active={fullOn}
            aria-pressed={fullOn}
            disabled={busy}
            onclick={() => {
              custom = false;
              fullPicked = true;
            }}
          >
            {full.label} · {formatMinutes(full.minutes)}
          </button>
        {/if}
        {#each PRESETS as value (value)}
          <button
            type="button"
            class="chip"
            class:active={!custom && !fullOn && minutes === value}
            aria-pressed={!custom && !fullOn && minutes === value}
            disabled={busy}
            onclick={() => pick(value)}
          >
            {formatMinutes(value)}
          </button>
        {/each}
        <button
          type="button"
          class="chip"
          class:active={custom && !fullOn}
          aria-pressed={custom && !fullOn}
          disabled={busy}
          onclick={() => {
            custom = true;
            fullPicked = false;
          }}
        >
          Custom
        </button>
      </div>
    {/if}
    {#if custom}
      <label class="field-label" for="{id}-minutes">Minutes per session</label>
      <input
        id="{id}-minutes"
        class="field-input"
        type="number"
        min={floor}
        max={MAX_SESSION}
        step="1"
        inputmode="numeric"
        value={Number.isFinite(minutes) ? minutes : ""}
        disabled={busy}
        oninput={(event) => (minutes = readInt(event))}
      />
      {#if stepper && full && Number.isFinite(minutes) && minutes < full.minutes}
        <p class="sheet-hint">At least one episode ({formatMinutes(full.minutes)}).</p>
      {/if}
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

  .stepper {
    display: grid;
    grid-template-columns: $touch-target 1fr $touch-target;
    align-items: center;
    gap: $spacing-xs $spacing-sm;
  }

  .step {
    width: $touch-target;
    height: $touch-target;
    border-radius: $radius-full;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    background: none;
    color: var(--clr-text);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;

    &:disabled {
      opacity: 0.35;
      cursor: default;
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
  }

  .step-value {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: $touch-target;
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-lg;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    background: none;
    color: var(--clr-text-2);
    cursor: pointer;

    &.active {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-on-primary);

      .step-minutes {
        color: rgb(var(--clr-on-primary-rgb) / 0.75);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }
  }

  .step-title {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .step-minutes {
    font-size: 0.72rem;
    color: var(--clr-text-3);
  }

  // Discreet: plain underlined text until picked, then a small filled pill.
  .step-custom {
    grid-column: 3;
    justify-self: end;
    min-height: 32px;
    padding: 0 $spacing-sm;
    border: none;
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text-3);
    font-size: 0.75rem;
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
    cursor: pointer;

    &.active {
      background: var(--clr-primary);
      color: var(--clr-on-primary);
      text-decoration: none;
      font-weight: 600;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
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
      color: var(--clr-on-primary);
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
