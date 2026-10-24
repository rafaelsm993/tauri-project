<script lang="ts">
  import type { Snippet } from "svelte";
  import { collapseOnScroll, type HeaderScroll } from "$lib/domain/navigation";

  // `heading` is the page's own <h1> ("Library"). Home has none: its search takes the first row.
  let {
    heading,
    action,
    persistent,
    collapsible,
  }: {
    heading?: string;
    action?: Snippet;
    persistent?: Snippet;
    collapsible?: Snippet;
  } = $props();

  let scroll = $state<HeaderScroll>({ y: 0, collapsed: false });

  $effect(() => {
    const onScroll = () => {
      scroll = collapseOnScroll(scroll, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  });
</script>

<header class="app-header" data-collapsed={scroll.collapsed}>
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
    <div class="collapsible">{@render collapsible()}</div>
  {/if}
</header>

<style lang="scss">
  .app-header {
    position: sticky;
    top: 0;
    z-index: var(--z-raised);
    display: flex;
    flex-direction: column;
  }

  // Each row carries its own ground rather than the header carrying one for all of them: a
  // hidden row must leave a transparent gap, not a painted blank band.
  .row,
  .collapsible {
    background: var(--clr-bg);
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

  // `visibility` keeps the row's box and paints nothing, so the page below never moves. Shrinking
  // or animating the row instead reflows the whole page on every scroll tick, and the reflow
  // shifts scrollY, which flips this very state back — the header then refuses to reappear on an
  // upward scroll. Content simply shows through the gap it leaves.
  .app-header[data-collapsed="true"] .collapsible {
    visibility: hidden;
  }
</style>
