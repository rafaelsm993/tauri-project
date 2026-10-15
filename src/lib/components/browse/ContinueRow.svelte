<script lang="ts">
  import LibraryCard from "$lib/components/library/LibraryCard.svelte";
  import type { LibraryEntry } from "$lib/types/library";

  let { entries, posterDir }: { entries: LibraryEntry[]; posterDir: string | null } = $props();
</script>

{#if entries.length > 0}
  <section class="continue" aria-labelledby="continue-title">
    <h2 id="continue-title" class="continue-title">Continue</h2>
    <ul class="rail">
      {#each entries as entry (entry.key)}
        <li class="rail-item"><LibraryCard {entry} {posterDir} /></li>
      {/each}
    </ul>
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
