<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    title,
    hint = "",
    hideTitle = false,
    area,
    children,
    action,
  }: {
    id: string;
    title: string;
    hint?: string;
    // Visually hidden when the card's content already says what it is.
    hideTitle?: boolean;
    // Grid area name in the dashboard layout.
    area: string;
    children: Snippet;
    action?: Snippet;
  } = $props();
</script>

<section class="card" style:grid-area={area} aria-labelledby="{id}-title">
  <header class="card-head" class:hidden={hideTitle && !action}>
    <div class="card-text">
      <h2 id="{id}-title" class="card-title" class:sr={hideTitle}>{title}</h2>
      {#if hint}<p class="card-hint">{hint}</p>{/if}
    </div>
    {@render action?.()}
  </header>
  {@render children()}
</section>

<style lang="scss">
  .card {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-width: 0;
    padding: $spacing-md $spacing-lg;
    background: rgb(var(--clr-surface-rgb) / 0.85);
    border: 1px solid var(--clr-border);
    border-radius: $radius-lg;

    @include respond-to(sm) {
      padding: $spacing-md;
    }
  }

  .card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;

    &.hidden {
      display: contents;
    }
  }

  .card-text {
    min-width: 0;
  }

  .card-title {
    @include label-style;
    color: var(--clr-text-2);

    &.sr {
      @include sr-only;
    }
  }

  .card-hint {
    margin-top: $spacing-xs;
    font-size: 0.85rem;
    color: var(--clr-text-3);
  }
</style>
