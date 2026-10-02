<script lang="ts">
  import type { Snippet } from "svelte";

  // `children` holds extra actions shown after the retry (e.g. Back).
  let {
    message,
    onretry,
    children,
  }: { message: string; onretry?: () => void; children?: Snippet } = $props();
</script>

<div class="error-note" role="alert">
  <span class="error-text">⚠ {message}</span>
  {#if onretry || children}
    <span class="error-actions">
      {#if onretry}
        <button type="button" onclick={onretry}>Try again</button>
      {/if}
      {@render children?.()}
    </span>
  {/if}
</div>

<style lang="scss">
  .error-note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm $spacing-md;
    padding: $spacing-md $spacing-lg;
    background: rgb(var(--clr-error-rgb) / 0.07);
    border: 1px solid rgb(var(--clr-error-rgb) / 0.2);
    border-radius: $radius-md;
    color: var(--clr-error);
    font-size: 0.84rem;
  }

  .error-text {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .error-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .error-actions :global(button) {
    background: none;
    border: 1px solid rgb(var(--clr-error-rgb) / 0.3);
    color: var(--clr-error);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    font-size: 0.76rem;
    white-space: nowrap;
    cursor: pointer;

    @include hover-capable {
      &:hover {
        background: rgb(var(--clr-error-rgb) / 0.1);
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
</style>
