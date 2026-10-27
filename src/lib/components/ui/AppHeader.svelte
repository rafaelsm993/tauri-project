<script lang="ts">
  import type { Snippet } from "svelte";
  import { motionStore } from "$lib/stores/motion.svelte";
  import { collapseOnScroll, type HeaderScroll } from "$lib/domain/navigation";

  // `heading` is the page's own <h1> ("Library"). Home has none: its search takes the first row.
  let {
    sticky = true,
    heading,
    action,
    persistent,
    collapsible,
  }: {
    sticky?: boolean;
    heading?: string;
    action?: Snippet;
    persistent?: Snippet;
    collapsible?: Snippet;
  } = $props();

  let scroll = $state<HeaderScroll>({ y: 0, collapsed: false });

  $effect(() => {
    if (!sticky) return;
    const onScroll = () => {
      scroll = collapseOnScroll(scroll, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  });
</script>

<header
  class="app-header"
  class:sticky
  data-collapsed={sticky && scroll.collapsed}
  data-stuck={sticky && scroll.y > 0}
  data-motion={motionStore.on}
>
  <div class="row">
    <!-- A page with a heading gets a title row (Library, Planner, Settings, Profile); Home has
         no <h1>, so its search shares this row rather than burning a whole one. -->
    {#if heading}
      <h1 class="heading">{heading}</h1>
    {:else if persistent}
      {@render persistent()}
    {/if}
    {#if action}{@render action()}{/if}
  </div>
  {#if heading && persistent}
    <div class="row">{@render persistent()}</div>
  {/if}
  {#if collapsible}
    <div class="collapsible" inert={sticky && scroll.collapsed}>
      <div class="collapsible-content">{@render collapsible()}</div>
    </div>
  {/if}
</header>

<style lang="scss">
  .app-header {
    display: flex;
    flex-direction: column;
    // Only the rows take taps: a collapsed row keeps its box, and the cards showing through that
    // gap must still be tappable. `visibility: hidden` already drops the hidden row's own taps.
    pointer-events: none;
  }

  .app-header.sticky {
    position: sticky;
    top: calc(var(--safe-top) + #{$spacing-sm});
    z-index: var(--z-raised);
  }

  // While stuck, paint from the screen edge down to the header: the status bar sits over the
  // page on Android, and scrolled posters behind the clock are unreadable. At rest the page's
  // own background shows there instead.
  .app-header[data-stuck="true"]::before {
    content: "";
    position: absolute;
    inset-inline: 0;
    bottom: calc(100% + #{$spacing-sm});
    height: var(--safe-top);
    background: var(--clr-bg);
    // Painted over the content, so it takes the taps that content can no longer be seen for.
    pointer-events: auto;
  }

  // Each row carries its own ground rather than the header carrying one for all of them: a
  // hidden row must leave a transparent gap, not a painted blank band.
  .row,
  .collapsible {
    background: transparent;
    pointer-events: auto;
  }

  .row {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    min-width: 0;
    padding-block: $spacing-xs;
  }

  .heading {
    @include page-title;
    margin: 0;
    // Takes the slack so the action sits at the trailing edge.
    flex: 1 1 auto;
    min-width: 0;
  }

  .collapsible {
    padding-bottom: $spacing-sm;
  }

  .collapsible-content {
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
    transition:
      opacity $dur-fast ease-out,
      transform $dur-fast ease-out,
      visibility 0s;
  }
  .app-header[data-collapsed="true"] .collapsible {
    pointer-events: none;
  }
  .app-header[data-collapsed="true"] .collapsible-content {
    opacity: 0;
    transform: translateY(-0.5rem);
    visibility: hidden;
    transition:
      opacity $dur-fast ease-out,
      transform $dur-fast ease-out,
      visibility 0s $dur-fast;
  }
  .app-header[data-motion="false"] .collapsible-content {
    transition: none;
  }
</style>
