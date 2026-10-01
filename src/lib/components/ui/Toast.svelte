<script lang="ts">
  import type { Snippet } from "svelte";

  // `accent` is an RGB channel token such as `--clr-highlight-rgb`; `resetKey` restarts auto-hide.
  let {
    open,
    label,
    onclose,
    children,
    actions,
    accent = "--clr-highlight-rgb",
    bar = false,
    autoHideMs,
    resetKey,
    motion = true,
    closeLabel,
  }: {
    open: boolean;
    label: string;
    onclose: () => void;
    children: Snippet;
    actions?: Snippet;
    accent?: string;
    bar?: boolean;
    autoHideMs?: number;
    resetKey?: unknown;
    motion?: boolean;
    closeLabel?: string;
  } = $props();

  // Side effect only: a timer per shown content, cleared when it changes or closes.
  $effect(() => {
    void resetKey;
    if (!open || autoHideMs === undefined) return;
    const timer = setTimeout(onclose, autoHideMs);
    return () => clearTimeout(timer);
  });
</script>

<div class="toast-region" role="status" aria-live="polite" aria-label={label}>
  {#if open}
    <div class="toast" class:bar class:still={!motion} style:--accent="var({accent})">
      {@render children()}
      {#if actions}
        <div class="toast-actions">{@render actions()}</div>
      {/if}
      <button type="button" class="toast-close" aria-label={closeLabel} onclick={onclose}>
        Close
      </button>
    </div>
  {/if}
</div>

<style lang="scss">
  // Above the bottom band where the back-to-top button and the offline pill sit.
  .toast-region {
    position: fixed;
    inset: auto $spacing-md
      calc(#{$spacing-lg + $touch-target + $spacing-sm} + env(safe-area-inset-bottom)) auto;
    z-index: var(--z-toast);
    display: flex;
    justify-content: flex-end;
    max-width: calc(100vw - 2 * #{$spacing-md});
    pointer-events: none;

    @include respond-to(sm) {
      inset-inline: $spacing-sm;
      justify-content: center;
      max-width: none;
    }
  }

  .toast {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-sm $spacing-md;
    min-width: 0;
    max-width: 100%;
    padding: $spacing-sm $spacing-sm $spacing-sm $spacing-md;
    pointer-events: auto;
    background: var(--clr-surface);
    color: var(--clr-text);
    border: 1px solid rgb(var(--accent) / 0.5);
    border-radius: $radius-md;
    box-shadow: 0 12px 32px rgb(var(--clr-shade-rgb) / 0.5);

    @media (prefers-reduced-motion: no-preference) {
      animation: toast-in $dur-normal ease-out;
    }

    &.still {
      animation: none;
    }

    &.bar {
      border-inline-start: 4px solid rgb(var(--accent));
    }
  }

  .toast-actions {
    display: flex;
    gap: $spacing-sm;
  }

  .toast-close {
    flex-shrink: 0;
    min-height: 36px;
    padding: 0 $spacing-sm;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: transparent;
    color: var(--clr-text-2);
    cursor: pointer;

    @include hover-capable {
      &:hover {
        color: var(--clr-text);
        border-color: var(--clr-primary);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
      min-width: $touch-target;
    }
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
</style>
