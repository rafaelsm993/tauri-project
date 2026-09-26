<script lang="ts" generics="T extends string">
  let {
    label,
    options,
    value,
    onchange,
    disabled = false,
    wrap = false,
  }: {
    label: string;
    options: { value: T; label: string; count?: number }[];
    value: T;
    onchange: (value: T) => void;
    disabled?: boolean;
    /** Wrap onto more rows instead of scrolling; for long option sets like a 1–10 rating. */
    wrap?: boolean;
  } = $props();
</script>

<div class="segmented" class:wrap role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      class="segment"
      class:active={option.value === value}
      aria-pressed={option.value === value}
      {disabled}
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

    &.wrap {
      flex-wrap: wrap;
      overflow-x: visible;
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
      color: var(--clr-text);
      font-weight: 600;
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
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

  .segment-count {
    font-family: $font-mono;
    font-size: 0.72rem;
    color: var(--clr-text-3);

    .active & {
      color: var(--clr-text);
    }
  }
</style>
