<script lang="ts">
  import type { Moment } from "$lib/domain/gamification";

  let { moment, onclose }: { moment: Moment | null; onclose: () => void } = $props();

  const SHOW_MS = 6_000;

  // Side effect only: a timer per moment, cleared when it changes or closes.
  $effect(() => {
    if (!moment) return;
    const timer = setTimeout(onclose, SHOW_MS);
    return () => clearTimeout(timer);
  });
</script>

<div class="toast-region" role="status" aria-live="polite">
  {#if moment}
    <div class="toast">
      <p class="toast-text">
        <span class="toast-level">Level {moment.level}</span>
        {#if moment.newTitle}
          <span class="toast-title">New title: {moment.newTitle}</span>
        {/if}
      </p>
      <button type="button" class="toast-close" onclick={onclose}>Close</button>
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
    align-items: center;
    gap: $spacing-md;
    min-width: 0;
    max-width: 100%;
    padding: $spacing-sm $spacing-sm $spacing-sm $spacing-md;
    pointer-events: auto;
    background: var(--clr-surface);
    color: var(--clr-text);
    border: 1px solid rgb(var(--clr-highlight-rgb) / 0.5);
    border-radius: $radius-md;
    box-shadow: 0 12px 32px rgb(var(--clr-shade-rgb) / 0.5);

    @media (prefers-reduced-motion: no-preference) {
      animation: toast-in $dur-normal ease-out;
    }
  }

  .toast-text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 $spacing-sm;
    min-width: 0;
  }

  .toast-level {
    font-family: $font-display;
    font-size: 1.4rem;
    letter-spacing: 0.03em;
    color: rgb(var(--clr-highlight-rgb));
  }

  .toast-title {
    font-size: 0.9rem;
    color: var(--clr-text-2);
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
