<script lang="ts">
  import PlannableCard from "$lib/components/library/PlannableCard.svelte";
  import type { ContinueItem } from "$lib/domain/libraryView";

  let {
    items,
    posterDir,
    note = null,
  }: {
    items: ContinueItem[];
    posterDir: string | null;
    // "2 earlier sessions re-planned · ...", shown under the title.
    note?: string | null;
  } = $props();
</script>

{#if items.length > 0 || note}
  <section class="continue" aria-labelledby="continue-title">
    <h2 id="continue-title" class="continue-title">Continue</h2>
    {#if note}<p class="continue-note">{note}</p>{/if}
    {#if items.length > 0}
      <ul class="rail">
        {#each items as { entry, dueMinutes } (entry.key)}
          <li class="rail-item"><PlannableCard {entry} {posterDir} {dueMinutes} /></li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style lang="scss">
  .continue {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    margin-bottom: $spacing-xl;
    min-width: 0;
  }

  .continue-title {
    font-family: $font-display;
    font-size: 1.25rem;
    letter-spacing: 0.04em;
    margin: 0;
    padding: 0 $spacing-xs;
    color: var(--clr-text);
  }

  .continue-note {
    margin: 0;
    padding: 0 $spacing-xs;
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .rail {
    @include card-rail;
    margin: 0;
    list-style: none;
  }

  .rail-item {
    scroll-snap-align: start;
    width: clamp(120px, 38vw, 160px);
    min-width: 0;
  }
</style>
