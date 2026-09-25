<script lang="ts">
  import { clampProgress, isBinary, percent, progressLabel } from "$lib/domain/progress";
  import type { MediaType } from "$lib/types/media";

  let {
    mediaType,
    progress,
    total,
    rating,
    onprogress,
    onrating,
    disabled = false,
    plannable = true,
    onaddlength = undefined,
  } = $props<{
    mediaType: MediaType;
    progress: number;
    total: number | null;
    rating: number | null;
    onprogress: (value: number) => void;
    onrating: (value: number | null) => void;
    disabled?: boolean;
    plannable?: boolean;
    onaddlength?: () => void;
  }>();

  const id = $props.id();
  const progressId = `${id}-progress`;
  const ratingId = `${id}-rating`;

  const binary = $derived(isBinary(mediaType));
  const label = $derived(progressLabel(mediaType, progress, total));
  // A watched/not-watched item has nothing to fill a bar with.
  const pct = $derived(binary ? null : percent(progress, total));
  const scale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  function changeProgress(event: Event) {
    const raw = Number((event.currentTarget as HTMLInputElement).value);
    onprogress(clampProgress(mediaType, Number.isFinite(raw) ? raw : 0));
  }

  function toggleWatched(event: Event) {
    onprogress((event.currentTarget as HTMLInputElement).checked ? 1 : 0);
  }

  function changeRating(event: Event) {
    const raw = (event.currentTarget as HTMLSelectElement).value;
    onrating(raw === "" ? null : Number(raw));
  }
</script>

<div class="progress-editor">
  <div class="progress-field">
    {#if binary}
      <label class="field-label" for={progressId}>Watched</label>
      <input
        id={progressId}
        type="checkbox"
        checked={progress > 0}
        {disabled}
        onchange={toggleWatched}
      />
    {:else}
      <label class="field-label" for={progressId}>Progress</label>
      <input
        id={progressId}
        class="progress-input"
        type="number"
        min="0"
        step="1"
        value={progress}
        {disabled}
        oninput={changeProgress}
      />
    {/if}
    <span class="progress-text">{label}</span>
  </div>

  {#if !plannable}
    <p class="length-hint">
      Length unknown.
      {#if onaddlength}
        <button type="button" class="length-link" {disabled} onclick={onaddlength}>
          Add length
        </button>
      {/if}
    </p>
  {/if}

  {#if pct !== null}
    <div
      class="progress-bar"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label={label}
    >
      <div class="progress-fill" style="width: {pct}%"></div>
    </div>
  {/if}

  <div class="progress-field">
    <label class="field-label" for={ratingId}>Rating</label>
    <select
      id={ratingId}
      class="rating-select"
      value={rating === null ? "" : String(rating)}
      {disabled}
      onchange={changeRating}
    >
      <option value="">Unrated</option>
      {#each scale as value (value)}
        <option value={String(value)}>{value}</option>
      {/each}
    </select>
  </div>
</div>

<style lang="scss">
  .progress-editor {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    margin-bottom: $spacing-lg;
  }

  .progress-field {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-wrap: wrap;
  }

  .field-label {
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .progress-input {
    width: 5rem;
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    font-size: 0.8rem;
  }

  .progress-text {
    font-size: 0.8rem;
    color: var(--clr-text-2);
  }

  .progress-bar {
    height: 4px;
    background: rgb(var(--clr-ink-rgb) / 0.1);
    border-radius: $radius-full;
    overflow: hidden;
    max-width: 22rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--clr-primary);
    transition: width 0.24s ease;
  }

  .length-hint {
    font-size: 0.78rem;
    color: var(--clr-text-3);
  }

  .length-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--clr-accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;

    @include touch {
      min-height: $touch-target;
    }
  }

  .rating-select {
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    font-size: 0.8rem;
    cursor: pointer;
  }
</style>
