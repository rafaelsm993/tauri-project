<script lang="ts">
  import Plant from "./Plant.svelte";
  import { scene, SCENE_CAP } from "$lib/domain/garden";
  import { motionStore } from "$lib/stores/motion.svelte";
  import { unlocksStore } from "$lib/stores/unlocks.svelte";
  import { plural } from "$lib/utils/format";
  import type { LibraryEntry } from "$lib/types/library";

  // `cap`, `motion` and `sway` exist for tests; the app uses the cap, the saved setting and the
  // equipped garden reward.
  let {
    entries,
    cap = SCENE_CAP,
    motion,
    sway,
  }: {
    entries: LibraryEntry[];
    cap?: number;
    motion?: boolean;
    sway?: boolean;
  } = $props();

  const moves = $derived(motion ?? motionStore.on);
  // Motion off always wins: a reward never forces movement on someone who turned it off.
  const sways = $derived(moves && (sway ?? unlocksStore.garden === "sway"));
  const grown = $derived(scene(entries, cap));
</script>

{#if grown.plants.length === 0}
  <p class="garden-empty">Nothing growing yet. Save something and it takes root here.</p>
{:else}
  <div class="garden" class:moves class:sways>
    <ul class="garden-bed" aria-label="Your garden">
      {#each grown.plants as plant, i (plant.key)}
        <li style:--sway-phase="{(i % 7) * -0.8}s"><Plant {plant} /></li>
      {/each}
    </ul>
    {#if grown.more > 0}
      <p class="garden-more">{plural(grown.more, "more item")} — switch to the grid to see them.</p>
    {/if}
  </div>
{/if}

<style lang="scss">
  .garden {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    min-width: 0;
  }

  // Plants sit on a soil line and wrap with the width; no absolute canvas.
  // The line is per row, so a wrapped row still has ground under it.
  .garden-bed {
    list-style: none;
    margin: 0;
    padding: $spacing-md 0 0;
    display: grid;
    // Fixed tracks, not 1fr: a half-empty row must not stretch its soil to the window edge.
    grid-template-columns: repeat(auto-fill, clamp(52px, 7vw, 76px));
    justify-content: start;
    align-items: end;
    row-gap: $spacing-lg;

    > li {
      min-width: 0;
      display: grid;
      border-bottom: 2px solid rgb(var(--clr-teal-rgb) / 0.4);
    }
  }

  .garden-empty,
  .garden-more {
    color: var(--clr-text-2);
    font-size: 0.9rem;
  }

  // Growth only animates when motion is allowed, and never on first paint.
  .garden.moves :global(.plant-art) {
    transition: height $dur-slow ease-out;
  }

  .garden.moves :global(.stem),
  .garden.moves :global(.crown) {
    transition:
      height $dur-slow ease-out,
      bottom $dur-slow ease-out,
      width $dur-slow ease-out;
  }

  // Measured on a Galaxy A34: swaying ten plants costs 126% CPU, the same page without the
  // animation 0.7%. Animating one transform is no cheaper there than a full-screen layer, so
  // the sway is desktop-only like the background motifs.
  @include touch {
    .garden.sways :global(.plant-art) {
      animation: none;
    }
  }

  // Only transform animates, so the browser composites it without laying the bed out again.
  // The index sets the phase, so neighbours lean at different times instead of in lockstep.
  .garden.sways :global(.plant-art) {
    animation: garden-sway 5.5s ease-in-out infinite;
    animation-delay: var(--sway-phase, 0s);
  }

  @keyframes garden-sway {
    0%,
    100% {
      transform: rotate(-1.4deg);
    }
    50% {
      transform: rotate(1.4deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .garden.sways :global(.plant-art) {
      animation: none;
    }

    .garden.moves :global(.plant-art),
    .garden.moves :global(.stem),
    .garden.moves :global(.crown) {
      transition: none;
    }
  }
</style>
