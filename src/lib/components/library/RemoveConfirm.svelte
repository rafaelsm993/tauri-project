<script lang="ts">
  // Asks before an item leaves the library; `xp` is what it earned (0 leaves the line out).
  let {
    title,
    xp,
    onremove,
    onkeep,
  }: { title: string; xp: number; onremove: () => void; onkeep: () => void } = $props();
</script>

<div class="confirm">
  <h2 class="confirm-title">Remove {title}?</h2>
  <p class="confirm-text">Its progress, rating and plan go with it.</p>
  {#if xp > 0}
    <p class="confirm-text">You lose the {xp} XP it earned.</p>
  {/if}
  <div class="confirm-actions">
    <button type="button" class="btn danger" onclick={onremove}>Remove</button>
    <button type="button" class="btn" onclick={onkeep}>Keep</button>
  </div>
</div>

<style lang="scss">
  .confirm {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    width: min(24rem, 100%);
    padding: $spacing-lg;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }

  .confirm-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
    overflow-wrap: anywhere;
  }

  .confirm-text {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    margin-top: $spacing-sm;
  }

  .btn {
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.85rem;
    cursor: pointer;

    &.danger {
      background: var(--clr-error);
      border-color: transparent;
      color: var(--clr-on-primary);
      font-weight: 600;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
      padding-inline: $spacing-lg;
    }
  }
</style>
