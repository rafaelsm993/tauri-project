<script lang="ts">
  import type { Snippet } from "svelte";
  import LevelChip from "./LevelChip.svelte";
  import { collapseOnScroll, type HeaderScroll } from "$lib/domain/navigation";
  import { gamificationStore } from "$lib/stores/gamification.svelte";
  import type { LevelInfo } from "$lib/domain/gamification";

  type Progress = { ready: boolean; level: LevelInfo; title: { name: string } };

  // `heading` is the page's own <h1> ("Library"); the chip's rank name comes from the store, so
  // no page has to derive it. The store is a prop only so tests can hand in a stand-in.
  let {
    heading,
    action,
    persistent,
    collapsible,
    gamification = gamificationStore,
  }: {
    heading?: string;
    action?: Snippet;
    persistent?: Snippet;
    collapsible?: Snippet;
    gamification?: Progress;
  } = $props();

  const progress = $derived(
    gamification.ready ? { level: gamification.level, title: gamification.title.name } : undefined,
  );

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
    {#if progress}
      <span class="chip-slot"><LevelChip level={progress.level} title={progress.title} /></span>
    {/if}
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
    // Takes the slack so the action and chip sit at the trailing edge.
    flex: 1 1 auto;
    min-width: 0;
  }

  .chip-slot {
    flex: 0 0 auto;
    margin-inline-start: auto;
  }

  .heading ~ .chip-slot {
    margin-inline-start: 0;
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
