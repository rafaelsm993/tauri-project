<script lang="ts">
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
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
  }: {
    mediaType: MediaType;
    progress: number;
    total: number | null;
    rating: number | null;
    onprogress: (value: number) => void;
    onrating: (value: number | null) => void;
    disabled?: boolean;
    plannable?: boolean;
    onaddlength?: () => void;
  } = $props();

  const id = $props.id();
  const progressId = `${id}-progress`;

  const binary = $derived(isBinary(mediaType));
  const label = $derived(progressLabel(mediaType, progress, total));
  // A watched/not-watched item has nothing to fill a bar with.
  const pct = $derived(binary ? null : percent(progress, total));
  const ratingOptions = [
    { value: "", label: "Unrated" },
    ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  ];

  function changeProgress(event: Event) {
    const raw = Number((event.currentTarget as HTMLInputElement).value);
    onprogress(clampProgress(mediaType, Number.isFinite(raw) ? raw : 0));
  }

  function changeRating(raw: string) {
    onrating(raw === "" ? null : Number(raw));
  }
</script>

<div class="progress-editor">
  {#if !binary}
    <div class="progress-field">
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
      <span class="progress-text">{label}</span>
    </div>
  {/if}

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
    <span class="field-label" aria-hidden="true">Rating</span>
    <div class="rating-control">
      <SegmentedControl
        label="Rating"
        options={ratingOptions}
        value={rating === null ? "" : String(rating)}
        {disabled}
        onchange={changeRating}
      />
    </div>
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
    color-scheme: dark;
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

  .rating-control {
    min-width: 0;
    max-width: 100%;
  }
</style>
