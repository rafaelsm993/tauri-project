<script lang="ts">
  // Snap-scrolling row of MediaCards for one genre on the home page.
  import type { MediaItem } from "$lib/types/media";
  import MediaCard from "$lib/components/media/MediaCard.svelte";
  import ErrorNote from "./ErrorNote.svelte";
  import Skeleton from "./Skeleton.svelte";

  let {
    title,
    items = [],
    loading = false,
    error = "",
    onCardClick,
    onSeeMore,
    onRetry,
  }: {
    title: string;
    items: MediaItem[];
    loading?: boolean;
    error?: string;
    onCardClick: (item: MediaItem) => void;
    onSeeMore?: () => void;
    onRetry?: () => void;
  } = $props();

  let railEl = $state<HTMLDivElement | undefined>(undefined);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  function refreshArrows() {
    if (!railEl) return;
    canScrollLeft = railEl.scrollLeft > 4;
    canScrollRight = railEl.scrollLeft + railEl.clientWidth < railEl.scrollWidth - 4;
  }

  function scrollByAmount(dir: -1 | 1) {
    if (!railEl) return;
    const amount = Math.round(railEl.clientWidth * 0.85) * dir;
    railEl.scrollBy({ left: amount, behavior: "smooth" });
  }

  const showsCards = $derived(!loading && !error && items.length > 0);

  $effect(() => {
    if (railEl && showsCards) refreshArrows();
  });
</script>

<section class="carousel">
  <header class="carousel-head">
    <h2 class="carousel-title">{title}</h2>
    {#if onSeeMore && !loading && items.length > 0}
      <button type="button" class="see-more" onclick={onSeeMore}> See all → </button>
    {/if}
  </header>

  <div class="carousel-body">
    {#if error && !loading}
      <div class="rail-note">
        <ErrorNote message={error} onretry={onRetry} />
      </div>
    {:else}
      {#if canScrollLeft && !loading}
        <button
          type="button"
          class="nav-btn nav-btn-left"
          aria-label="Previous"
          onclick={() => scrollByAmount(-1)}
        >
          ‹
        </button>
      {/if}

      <div
        bind:this={railEl}
        class="rail"
        role={showsCards ? "list" : undefined}
        onscroll={refreshArrows}
      >
        {#if loading}
          <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- skeleton placeholder, only the index is used -->
          {#each { length: 8 } as _, i (i)}
            <div class="rail-item">
              <Skeleton poster />
            </div>
          {/each}
        {:else if items.length === 0}
          <p class="rail-empty">No items available.</p>
        {:else}
          {#each items as item (item.media_key)}
            <div class="rail-item" role="listitem">
              <MediaCard {item} onclick={() => onCardClick(item)} />
            </div>
          {/each}
        {/if}
      </div>

      {#if canScrollRight && !loading}
        <button
          type="button"
          class="nav-btn nav-btn-right"
          aria-label="Next"
          onclick={() => scrollByAmount(1)}
        >
          ›
        </button>
      {/if}
    {/if}
  </div>
</section>

<style lang="scss">
  .carousel {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    margin-bottom: $spacing-xl;
    min-width: 0; // critical: lets the rail's overflow:auto kick in
  }

  .carousel-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $spacing-md;
    padding: 0 $spacing-xs;
  }

  .carousel-title {
    font-family: $font-display;
    font-size: 1.25rem;
    letter-spacing: 0.04em;
    margin: 0;
    color: var(--clr-text);
  }

  .see-more {
    background: none;
    border: none;
    color: var(--clr-primary);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: $radius-sm;
    transition: color $dur-fast ease;
    &:hover {
      color: var(--clr-text);
    }
  }

  // ── Body / rail ─────────────────────────────────────────
  .carousel-body {
    position: relative;
    min-width: 0;
  }

  .rail {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 160px;
    gap: $spacing-md;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    padding: $spacing-xs;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .rail-item {
    scroll-snap-align: start;
    width: clamp(120px, 38vw, 160px);
    min-width: 0;

    // MediaCard's .card is an unwidth'd <button>, so within a grid track
    // it can fall back to intrinsic sizing and posters end up at varied
    // widths. Force every card to fill the rail track for a uniform row.
    :global(.card) {
      width: 100%;
    }
  }

  .rail-empty {
    color: var(--clr-text-3);
    font-size: 0.82rem;
    padding: $spacing-xl 0;
    text-align: center;
    width: 100%;
  }

  .rail-note {
    padding: $spacing-xs;
  }

  // ── Nav arrows ──────────────────────────────────────────
  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    width: 36px;
    height: 56px;
    border: none;
    border-radius: $radius-sm;
    color: var(--clr-text);
    background: rgb(var(--clr-scrim-rgb) / 0.75);
    backdrop-filter: blur(6px);
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity $dur-fast ease,
      background $dur-fast ease;
  }

  .nav-btn-left {
    left: -10px;
  }
  .nav-btn-right {
    right: -10px;
  }

  .carousel-body:hover .nav-btn,
  .nav-btn:focus-visible {
    opacity: 1;
  }

  .nav-btn:hover {
    background: rgb(var(--clr-highlight-rgb) / 0.85);
    color: var(--clr-bg);
  }
</style>
