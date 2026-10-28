<script lang="ts">
  import ProfileArtwork from "./ProfileArtwork.svelte";
  import { PROFILE_ART } from "$lib/domain/profileArt";
  let {
    art = "default",
    size = 32,
    scale = 1,
    decorative = false,
  }: {
    art?: string;
    size?: 24 | 32;
    scale?: 1 | 2 | 3 | 4;
    decorative?: boolean;
  } = $props();
  const known = $derived(PROFILE_ART.some((a) => a.id === art));
</script>

{#if known}
  <ProfileArtwork {art} {size} {scale} {decorative} />
{:else}
  <svg
    class="default-avatar"
    role="img"
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : "Default avatar"}
    viewBox="0 0 24 24"
    width={size * scale}
    height={size * scale}
  >
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
{/if}

<style lang="scss">
  .default-avatar {
    display: block;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
