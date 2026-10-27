<script lang="ts">
  import type { MediaType } from "$lib/types/media";
  import { shouldReveal } from "$lib/domain/navigation";

  // `short` is only set where the full label cannot fit a ~54px slot on a 360px phone; the full
  // label still goes to `aria-label`, so nothing is renamed for a screen reader.
  type Category = { key: MediaType; label: string; short?: string; icon: string };

  // Stroked outlines at 24x24, matching the house style in AppNav.
  const CATEGORIES: Category[] = [
    { key: "movie", label: "Movies", icon: "M3 6h18v12H3zM7 6v12M17 6v12" },
    { key: "tv", label: "TV Shows", short: "TV", icon: "M3 5h18v11H3zM12 16v4M8 20h8" },
    {
      key: "anime",
      label: "Anime",
      icon: "M12 4l1.8 4.7L18 10l-4.2 1.3L12 16l-1.8-4.7L6 10l4.2-1.3zM18.2 15.2l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z",
    },
    { key: "manga", label: "Manga", icon: "M20 4H4v12h4v4l4-4h8z" },
    {
      key: "book",
      label: "Books",
      icon: "M12 7C9.5 5 4 5 4 5v13c5.5 0 8 2 8 2s2.5-2 8-2V5s-5.5 0-8 2zM12 7v13",
    },
    {
      key: "game",
      label: "Games",
      icon: "M8 9h8a5 5 0 0 1 0 10H8a5 5 0 0 1 0-10zM10 12v4M8 14h4M15.5 13h.01M17.5 15.5h.01",
    },
  ];

  let {
    active,
    onchange,
  }: {
    active: MediaType;
    onchange: (category: MediaType) => void;
  } = $props();

  let railEl: HTMLElement | undefined = $state();

  // A taste pick can select a tab that sits outside the scrolled rail, leaving selection
  // looking unset. The scroll distance is decided by shouldReveal, tested on its own.
  function reveal(tab: HTMLElement) {
    if (!railEl) return;
    const by = shouldReveal(railEl.getBoundingClientRect(), tab.getBoundingClientRect());
    if (by !== 0) railEl.scrollLeft += by;
  }

  $effect(() => {
    const tab = railEl?.querySelector<HTMLElement>(`[data-category="${active}"]`);
    if (tab) reveal(tab);
  });
</script>

<div class="category-bar">
  <nav class="category-tabs" aria-label="Categories" bind:this={railEl}>
    {#each CATEGORIES as cat (cat.key)}
      <button
        type="button"
        class="category-tab"
        data-category={cat.key}
        class:active={active === cat.key}
        aria-pressed={active === cat.key}
        aria-label={cat.label}
        onclick={() => onchange(cat.key)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={cat.icon} /></svg>
        <span class="label">{cat.short ?? cat.label}</span>
      </button>
    {/each}
  </nav>
</div>

<style lang="scss">
  // The pill lives on the bar; only the tab list scrolls inside it.
  .category-bar {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding: 3px;
    background: var(--clr-surface);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.06);
    border-radius: $radius-full;
    max-width: 100%;
    min-width: 0;
  }

  .category-tabs {
    display: flex;
    gap: $spacing-xs;
    min-width: 0;
    border-radius: $radius-full;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  .category-tab {
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.76rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--clr-text-3);
    background: transparent;
    border: none;
    cursor: pointer;
    transition:
      color $dur-normal ease,
      background-color $dur-normal ease,
      box-shadow $dur-normal ease;

    // Desktop has room for all six text labels, so the icon only earns its place where space
    // is short; hiding it here keeps the familiar pill row unchanged.
    svg {
      display: none;
    }

    &:hover {
      color: var(--clr-text);
      background: rgb(var(--clr-ink-rgb) / 0.05);
    }

    &.active {
      color: var(--clr-bg);
      background: var(--clr-primary);
      font-weight: 700;
      box-shadow: 0 0 12px rgb(var(--clr-primary-rgb) / 0.3);
    }

    flex: 0 0 auto;
    white-space: nowrap;

    @include touch {
      min-height: $touch-target;
      padding-inline: $spacing-md;
    }
  }

  // Six fixed categories, so show all six: a scrolling rail hid four of them. Keyed on width,
  // not on touch, because the desktop window minimum is 360px and reaches this layout too.
  @include respond-to(md) {
    .category-tabs {
      overflow-x: visible;
      gap: 0;
      // Without this the nav is sized by its content, so `flex: 1 1 0` tabs below collapse to
      // their minimum width (34px) and ellipsise their labels instead of sharing the bar.
      flex: 1 1 auto;
    }

    .category-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      flex: 1 1 0;
      min-width: 0;
      padding-inline: 2px;
      font-size: 0.625rem;
      letter-spacing: 0;

      svg {
        display: block;
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .label {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
</style>
