<script lang="ts">
  // Flat results grid with skeletons and infinite scroll.
  import type { MediaItem } from "$lib/types/media";
  import MediaCard from "$lib/components/media/MediaCard.svelte";
  import Skeleton from "$lib/components/ui/Skeleton.svelte";

  let {
    items,
    loading,
    appending,
    hasMore,
    hasError,
    onCardClick,
    onLoadMore,
  }: {
    items: MediaItem[];
    loading: boolean;
    appending: boolean;
    hasMore: boolean;
    hasError: boolean;
    onCardClick: (item: MediaItem) => void;
    onLoadMore: () => void;
  } = $props();

  let sentinel = $state<HTMLDivElement | undefined>(undefined);

  // Re-attaches when the sentinel re-renders; cleanup disconnects the previous observer.
  $effect(() => {
    if (loading || items.length === 0 || !sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });
</script>

{#if loading}
  <div class="grid">
    <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- skeleton placeholder, only the index is used -->
    {#each { length: 20 } as _, i (i)}
      <Skeleton poster />
    {/each}
  </div>
{:else if !hasError && items.length === 0}
  <p class="page-empty">No results found.</p>
{:else}
  <div class="grid">
    {#each items as item (item.media_key)}
      <MediaCard {item} onclick={() => onCardClick(item)} />
    {/each}
    {#if appending}
      <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- skeleton placeholder, only the index is used -->
      {#each { length: 8 } as _, i (i)}
        <Skeleton poster />
      {/each}
    {/if}
  </div>

  {#if hasMore}
    <div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
  {:else if items.length > 0 && !appending}
    <p class="page-end">— End of results —</p>
  {/if}
{/if}

<style lang="scss">
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: $spacing-lg $spacing-md;
  }

  .page-empty,
  .page-end {
    text-align: center;
    color: var(--clr-text-3);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    padding: $spacing-2xl 0;
  }

  .sentinel {
    height: 1px;
  }
</style>
