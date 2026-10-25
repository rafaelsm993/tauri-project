<script lang="ts">
  import { PROFILE_ART, artworkPaths } from "$lib/domain/profileArt";
  let {
    art,
    size = 32,
    scale = 1,
    decorative = false,
  }: { art: string; size?: 24 | 32; scale?: 1 | 2 | 3 | 4; decorative?: boolean } = $props();
  const reward = $derived(PROFILE_ART.find((reward) => reward.id === art));
  const paths = $derived(artworkPaths(art, size));
</script>

{#if reward}
  <svg
    class="profile-artwork"
    role="img"
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : `${reward.name} artwork`}
    viewBox="0 0 {size} {size}"
    width={size * scale}
    height={size * scale}
    shape-rendering="crispEdges"
  >
    {#each paths as { tone, d } (tone)}
      <path class={tone} {d} />
    {/each}
  </svg>
{/if}

<style lang="scss">
  .profile-artwork {
    display: block;
    flex-shrink: 0;
  }
  .outline {
    fill: color-mix(in srgb, var(--clr-primary) 16%, rgb(var(--clr-shade-rgb)));
  }
  .shade {
    fill: color-mix(in srgb, var(--clr-primary) 40%, rgb(var(--clr-shade-rgb)));
  }
  .body {
    fill: color-mix(in srgb, var(--clr-primary) 70%, rgb(var(--clr-shade-rgb)));
  }
  .accent {
    fill: var(--clr-primary);
  }
  .glint {
    fill: color-mix(in srgb, var(--clr-primary) 40%, rgb(var(--clr-highlight-rgb)));
  }
</style>
