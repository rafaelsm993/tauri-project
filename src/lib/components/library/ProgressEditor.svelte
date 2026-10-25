<script lang="ts">
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import LengthNote from "./LengthNote.svelte";
  import { EDIT_ICON } from "$lib/components/ui/icons";
  import { clampProgress, isBinary, percent, unitLabel } from "$lib/domain/progress";
  import { STATUS_LABELS } from "$lib/stores/library.svelte";
  import type { LibraryStatus } from "$lib/types/library";
  import type { MediaType } from "$lib/types/media";

  let {
    mediaType,
    progress,
    total,
    status,
    rating,
    onprogress,
    onrating,
    disabled = false,
    plannable = true,
    onaddlength = undefined,
    lengthNote = "",
  }: {
    mediaType: MediaType;
    progress: number;
    total: number | null;
    status: LibraryStatus;
    rating: number | null;
    onprogress: (value: number) => void;
    onrating: (value: number | null) => void;
    disabled?: boolean;
    plannable?: boolean;
    onaddlength?: () => void;
    lengthNote?: string;
  } = $props();

  const id = $props.id();
  const binary = $derived(isBinary(mediaType));
  const one = $derived(unitLabel(mediaType, 1));
  // While the bar is dragged the count follows it; the save happens once, on release.
  let dragging = $state<number | null>(null);
  const shown = $derived(dragging ?? progress);
  const pct = $derived(percent(shown, total) ?? 0);
  const valueText = $derived(
    total === null
      ? `${shown} ${unitLabel(mediaType, shown)}`
      : `${shown} of ${total} ${unitLabel(mediaType, total)}`,
  );
  const ratingOptions = [
    { value: "", label: "Unrated" },
    ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  ];

  function commit(value: number) {
    dragging = null;
    const next = clampProgress(mediaType, value);
    if (next !== progress) onprogress(next);
  }

  function changeRating(raw: string) {
    onrating(raw === "" ? null : Number(raw));
  }
</script>

<section class="progress-card" aria-labelledby="{id}-title">
  <div class="card-head">
    <h2 class="card-title" id="{id}-title">Your progress</h2>
    <span class="status-badge" data-status={status}
      ><span class="sr">Status:&nbsp;</span>{STATUS_LABELS[status]}</span
    >
  </div>

  {#if binary}
    <div class="card-row">
      <button
        type="button"
        class="watched"
        aria-pressed={progress > 0}
        {disabled}
        onclick={() => commit(progress > 0 ? 0 : 1)}
      >
        <span aria-hidden="true">{progress > 0 ? "✓" : "○"}</span> Watched
      </button>
      {#if plannable && onaddlength}{@render editLength()}{/if}
    </div>
  {:else}
    <p class="count">
      <strong class="count-now">{shown}</strong>
      {#if total !== null}
        <span class="count-of">/ {total} {unitLabel(mediaType, total)}</span>
      {:else}
        <span class="count-of">{unitLabel(mediaType, shown)}</span>
      {/if}
    </p>
    {#if total !== null}
      <!-- The pixel art is drawn by spans; the range input on top does the dragging, tapping and keys. -->
      <div class="boss-bar" style="--pct: {pct}%" data-full={shown >= total ? "" : undefined}>
        <span class="px-border px-top" aria-hidden="true"></span>
        <span class="px-border px-bottom" aria-hidden="true"></span>
        <span class="px-border px-left" aria-hidden="true"></span>
        <span class="px-border px-right" aria-hidden="true"></span>
        <span class="px-border px-tl" aria-hidden="true"></span>
        <span class="px-border px-tr" aria-hidden="true"></span>
        <span class="px-border px-bl" aria-hidden="true"></span>
        <span class="px-border px-br" aria-hidden="true"></span>
        <span class="px-meter" aria-hidden="true">
          <span class="px-empty"></span>
          <span class="px-fill"></span>
          <span class="px-notches"></span>
        </span>
        <input
          type="range"
          class="boss-range"
          aria-label="Progress"
          aria-valuetext={valueText}
          min="0"
          max={total}
          step="1"
          value={shown}
          {disabled}
          oninput={(e) => (dragging = Number(e.currentTarget.value))}
          onchange={(e) => commit(Number(e.currentTarget.value))}
        />
      </div>
    {/if}
    <div class="card-row">
      <div class="steppers">
        <button
          type="button"
          class="step"
          aria-label="One {one} less"
          disabled={disabled || progress <= 0}
          onclick={() => commit(progress - 1)}>−</button
        >
        <button
          type="button"
          class="step"
          aria-label="One {one} more"
          disabled={disabled || (total !== null && progress >= total)}
          onclick={() => commit(progress + 1)}>+</button
        >
      </div>
      {#if plannable && onaddlength}{@render editLength()}{/if}
    </div>
  {/if}

  {#if !plannable && lengthNote && onaddlength}
    <LengthNote text={lengthNote} onadd={onaddlength} {disabled} />
  {:else if !plannable}
    <p class="length-hint">
      Length unknown. Add the length to finish it here.
      {#if onaddlength}
        <button type="button" class="length-link" {disabled} onclick={onaddlength}
          >Add length</button
        >
      {/if}
    </p>
  {/if}

  <div class="rating-field">
    <span class="field-label" aria-hidden="true">Rating</span>
    <div class="rating-control">
      <SegmentedControl
        label="Rating"
        wrap
        options={ratingOptions}
        value={rating === null ? "" : String(rating)}
        {disabled}
        onchange={changeRating}
      />
    </div>
  </div>
</section>

{#snippet editLength()}
  <button type="button" class="edit-length" {disabled} onclick={onaddlength}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
    Edit length
  </button>
{/snippet}

<style lang="scss">
  .progress-card {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    padding: $spacing-md;
    margin-bottom: $spacing-lg;
    background: rgb(var(--clr-surface-rgb) / 0.7);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }

  .card-head,
  .card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
    flex-wrap: wrap;
  }

  .card-title,
  .field-label {
    margin: 0;
    font-family: $font-mono;
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--clr-text-2);
  }

  .status-badge {
    padding: 2px $spacing-sm;
    border-radius: $radius-full;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgb(var(--clr-accent-rgb) / 0.14);
    color: var(--clr-text);

    &[data-status="completed"] {
      background: var(--clr-accent);
      color: var(--clr-on-primary);
    }

    &[data-status="dropped"] {
      background: rgb(var(--clr-ink-rgb) / 0.08);
      color: var(--clr-text-2);
    }
  }

  .count {
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: $spacing-xs;
  }

  .count-now {
    font-size: 2rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .count-of {
    color: var(--clr-text-2);
    font-size: 0.95rem;
  }

  // Pixel boss bar (Rafael's reference): a 5×5 grid whose edge cells are square "pixels", so the
  // frame has stepped corners. Cell = --px. The meter fills the middle cell.
  .boss-bar {
    --px: 3px;
    position: relative;
    display: grid;
    grid-template-columns: var(--px) var(--px) minmax(0, 1fr) var(--px) var(--px);
    grid-template-rows: var(--px) var(--px) calc(var(--px) * 5) var(--px) var(--px);

    // Bigger pixels on a phone: a thicker bar to hit with a thumb.
    @include respond-to(md) {
      --px: 4px;
    }
  }

  .px-border {
    // A faint line, like the app's other borders: the stepped corners carry the pixel look, not contrast.
    background: rgb(var(--clr-ink-rgb) / 0.18);
  }

  // Straight edges stop one pixel short of each corner; the corner pixels step in (the reference's border blocks 1–8).
  .px-top {
    grid-row: 1;
    grid-column: 3;
  }

  .px-bottom {
    grid-row: 5;
    grid-column: 3;
  }

  .px-left {
    grid-row: 3;
    grid-column: 1;
  }

  .px-right {
    grid-row: 3;
    grid-column: 5;
  }

  .px-tl {
    grid-row: 2;
    grid-column: 2;
  }

  .px-tr {
    grid-row: 2;
    grid-column: 4;
  }

  .px-bl {
    grid-row: 4;
    grid-column: 2;
  }

  .px-br {
    grid-row: 4;
    grid-column: 4;
  }

  // The centre cell. The ring of cells around it (row 2/4, column 2/4, minus the corner pixels) stays
  // empty: the one-pixel gap between frame and meter that the reference has.
  .px-meter {
    grid-row: 3;
    grid-column: 3;
    position: relative;
    overflow: hidden;
    background: rgb(var(--clr-shade-rgb) / 0.85);
  }

  // The empty side: diagonal stripes (the reference's .stripes), scrolling only with Animations on.
  .px-empty {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
      135deg,
      rgb(var(--clr-accent-rgb) / 0.3) 25%,
      transparent 25% 50%,
      rgb(var(--clr-accent-rgb) / 0.3) 50% 75%,
      transparent 75%
    );
    background-size: calc(var(--px) * 6) calc(var(--px) * 6);
  }

  :global(:root[data-motion="on"]) .px-empty {
    animation: boss-stripes 1.25s linear infinite;
  }

  @keyframes boss-stripes {
    to {
      background-position: calc(var(--px) * 12) 0;
    }
  }

  // The full side: three pixel bands like the reference's #sq rows (light top, accent body, dark base).
  .px-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--pct);
    background:
      linear-gradient(
        to bottom,
        rgb(var(--clr-on-primary-rgb) / 0.35) 0 var(--px),
        transparent var(--px) calc(100% - var(--px)),
        rgb(var(--clr-shade-rgb) / 0.45) calc(100% - var(--px))
      ),
      var(--clr-accent);
    // The leading edge: one brighter pixel column (the reference's next block).
    box-shadow: inset calc(var(--px) * -1) 0 0 rgb(var(--clr-on-primary-rgb) / 0.25);
  }

  .boss-bar[data-full] .px-fill {
    box-shadow: none;
  }

  // The width moves in pixel steps, never a smooth slide; the global Animations switch already zeroes it when off.
  :global(:root[data-motion="on"]) .px-fill {
    transition: width 0.24s steps(6, end);
  }

  // A dark one-pixel gap every 10%, like the reference's separate blocks.
  .px-notches {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to right,
      transparent 0 calc(10% - var(--px) / 2),
      rgb(var(--clr-shade-rgb) / 0.7) calc(10% - var(--px) / 2) 10%
    );
  }

  // The real control: invisible, over the whole bar, a touch target taller than the drawing.
  .boss-range {
    position: absolute;
    inset: -10px 0;
    width: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;

    &:disabled {
      cursor: progress;
    }

    // A 1 px thumb so a tap maps straight to its value along the width.
    &::-webkit-slider-thumb {
      appearance: none;
      width: 1px;
      height: 44px;
    }

    &::-moz-range-thumb {
      width: 1px;
      height: 44px;
      border: none;
    }
  }

  .boss-bar:has(.boss-range:focus-visible) {
    outline: 2px solid var(--clr-accent);
    outline-offset: 4px;
  }

  .boss-bar:has(.boss-range:disabled) {
    opacity: 0.6;
  }

  .steppers {
    display: flex;
    gap: $spacing-xs;
  }

  .step,
  .watched,
  .edit-length {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-xs;
    min-height: 36px;
    padding: 0 $spacing-md;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.14);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;

    &:disabled {
      opacity: 0.45;
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
    }
  }

  .step {
    min-width: 44px;
    font-size: 1.1rem;
  }

  .watched[aria-pressed="true"] {
    background: var(--clr-accent);
    border-color: transparent;
    color: var(--clr-on-primary);
    font-weight: 600;
  }

  .edit-length svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
  }

  .length-hint {
    margin: 0;
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

  .rating-field {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-wrap: wrap;
  }

  .rating-control {
    min-width: 0;
    max-width: 100%;
  }

  .sr {
    @include sr-only;
  }
</style>
