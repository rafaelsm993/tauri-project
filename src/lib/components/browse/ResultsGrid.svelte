<script lang="ts">
  // Flat results grid with skeletons and infinite scroll.
  import type { MediaItem } from "$lib/types/media";
  import MediaCard from "$lib/components/media/MediaCard.svelte";

  let { items, loading, appending, hasMore, hasError, onCardClick, onLoadMore } = $props<{
    items: MediaItem[];
    loading: boolean;
    appending: boolean;
    hasMore: boolean;
    hasError: boolean;
    onCardClick: (item: MediaItem) => void;
    onLoadMore: () => void;
  }>();

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

{#snippet SkeletonCard()}
  <div class="skeleton-card">
    <div class="skeleton-poster"></div>
    <div class="skeleton-line" style="width:68%"></div>
  </div>
{/snippet}

{#if loading}
  <div class="grid">
    <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- skeleton placeholder, only the index is used -->
    {#each { length: 20 } as _, i (i)}
      {@render SkeletonCard()}
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
        {@render SkeletonCard()}
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

  // ── Skeletons ───────────────────────────────────────────
  .skeleton-card {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .skeleton-poster {
    aspect-ratio: 2 / 3;
    border-radius: $radius-md;
    background: var(--clr-surface);
    overflow: hidden;
    position: relative;
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        transparent 0%,
        rgb(var(--clr-ink-rgb) / 0.05) 45%,
        rgb(var(--clr-ink-rgb) / 0.09) 50%,
        rgb(var(--clr-ink-rgb) / 0.05) 55%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.7s ease-in-out infinite;
    }
  }

  .skeleton-line {
    height: 9px;
    border-radius: $radius-sm;
    background: var(--clr-surface);
    position: relative;
    overflow: hidden;
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        transparent 0%,
        rgb(var(--clr-ink-rgb) / 0.05) 50%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.7s ease-in-out infinite 0.15s;
    }
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

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
