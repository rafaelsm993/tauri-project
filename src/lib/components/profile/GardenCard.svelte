<script lang="ts">
  import { resolve } from "$app/paths";
  import ChartCard from "./ChartCard.svelte";
  import GardenScene from "$lib/components/garden/GardenScene.svelte";
  import type { LibraryEntry } from "$lib/types/library";

  let { entries }: { entries: LibraryEntry[] } = $props();
</script>

<ChartCard id="garden" title="Garden" hint="Your library, growing" area="garden">
  {#snippet action()}
    <a class="garden-open" href={resolve("/library")}>Open the garden</a>
  {/snippet}
  <GardenScene {entries} cap={12} motion={false} />
</ChartCard>

<style lang="scss">
  .garden-open {
    color: var(--clr-accent);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
      display: inline-flex;
      align-items: center;
    }
  }
</style>
