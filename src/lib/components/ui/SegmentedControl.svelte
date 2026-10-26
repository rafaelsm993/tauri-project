<script lang="ts" generics="T extends string">
  let {
    label,
    options,
    value,
    onchange,
    disabled = false,
    wrap = false,
    fill = false,
    controls,
  }: {
    label: string;
    options: { value: T; label: string; count?: number; disabled?: boolean }[];
    value: T;
    onchange: (value: T) => void;
    disabled?: boolean;
    /** Wrap onto more rows instead of scrolling; for long option sets like a 1–10 rating. */
    wrap?: boolean;
    /** Share the row equally with tighter padding, wrapping only when even that won't fit. */
    fill?: boolean;
    controls?: string;
  } = $props();
</script>

<div class="segmented" class:wrap class:fill role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      class="segment"
      class:active={option.value === value}
      class:empty={option.disabled}
      aria-pressed={option.value === value}
      aria-controls={controls}
      disabled={disabled || option.disabled}
      onclick={() => onchange(option.value)}
    >
      {option.label}
      {#if option.count !== undefined}
        <span class="segment-count">{option.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style lang="scss">
  .segmented {
    display: flex;
    gap: $spacing-xs;
    overflow-x: auto;
    scrollbar-width: none;
    min-width: 0;

    &.wrap,
    &.fill {
      flex-wrap: wrap;
      overflow-x: visible;
    }

    &.fill .segment {
      flex: 1 1 0;
      min-width: max-content;
      justify-content: center;
      padding-inline: $spacing-sm;
    }
  }

  .segment {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text-2);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.8rem;
    white-space: nowrap;
    cursor: pointer;

    &.active {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-on-primary);
      font-weight: 600;
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    // Nothing to show under it: visible, but not pickable.
    &.empty:disabled {
      opacity: 0.38;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: -2px;
    }

    @include hover-capable {
      &:hover:not(.active) {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  // A small badge in the accent picked in Achievements.
  .segment-count {
    @include count-badge;

    .active & {
      background: rgb(var(--clr-on-primary-rgb) / 0.22);
      color: var(--clr-on-primary);
    }

    .empty & {
      background: rgb(var(--clr-ink-rgb) / 0.08);
      color: var(--clr-text-3);
    }
  }
</style>
