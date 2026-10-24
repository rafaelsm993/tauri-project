<script lang="ts">
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import { MediaQuery } from "svelte/reactivity";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import LibraryFilterPanel from "./LibraryFilterPanel.svelte";
  import { followTrigger } from "$lib/components/ui/popover";
  import {
    activeFilterCount,
    withEmptyDisabled,
    type FilterOption,
    type StatusFilter,
    type TypeFilter,
  } from "$lib/domain/libraryView";
  import { motionStore } from "$lib/stores/motion.svelte";

  // One row: Filters (Status + Type in a panel), the status as a token, the types as chips.
  let {
    statuses,
    types,
    status,
    type,
    onstatus,
    ontype,
    narrow,
  }: {
    statuses: FilterOption<StatusFilter>[];
    types: FilterOption<TypeFilter>[];
    status: StatusFilter;
    type: TypeFilter;
    onstatus: (value: StatusFilter) => void;
    ontype: (value: TypeFilter) => void;
    // Tests pin it; the app follows the 768px line where sheets become bottom sheets.
    narrow?: boolean;
  } = $props();

  const phone =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? new MediaQuery("(max-width: 768px)")
      : { current: false };
  const isNarrow = $derived(narrow ?? phone.current);

  const id = $props.id();
  const panelId = `${id}-filters`;
  let trigger = $state<HTMLButtonElement>();
  let panel = $state<HTMLDivElement>();
  let popoverOpen = $state(false);
  let sheetOpen = $state(false);

  const on = $derived(activeFilterCount({ status, type }));
  const statusLabel = $derived(statuses.find((s) => s.value === status)?.label ?? "");
  // Nothing picked means all, so there is no All chip; a picked type stands alone.
  const chips = $derived(
    withEmptyDisabled(types, type).filter(
      (t) => t.value !== "all" && (type === "all" || t.value === type),
    ),
  );
  const ms = $derived(motionStore.on ? 160 : 0);

  function reset() {
    onstatus("all");
    ontype("all");
  }

  $effect(() => {
    if (!popoverOpen || !trigger || !panel) return;
    return followTrigger(trigger, panel, "start");
  });

  // A fade on whichever edge hides more chips says the row scrolls.
  let row = $state<HTMLDivElement>();
  let fadeStart = $state(false);
  let fadeEnd = $state(false);
  function edges() {
    if (!row) return;
    fadeStart = row.scrollLeft > 1;
    fadeEnd = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
  }
  $effect(() => {
    void chips.length;
    if (!row) return;
    edges();
    const watch = new ResizeObserver(edges);
    watch.observe(row);
    return () => watch.disconnect();
  });
</script>

<div class="filter-bar">
  <button
    bind:this={trigger}
    type="button"
    class="filters-btn"
    class:on={on > 0}
    aria-label={on > 0 ? `Filters, ${on} on` : "Filters"}
    aria-expanded={isNarrow ? sheetOpen : popoverOpen}
    popovertarget={isNarrow ? undefined : panelId}
    onclick={() => {
      if (isNarrow) sheetOpen = true;
    }}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
    <span class="filters-word" aria-hidden="true">Filters</span>
    {#if on > 0}<span class="filters-badge" aria-hidden="true">{on}</span>{/if}
  </button>

  {#if status !== "all"}
    <button
      type="button"
      class="token"
      aria-label="Remove filter: {statusLabel}"
      transition:fade={{ duration: ms }}
      onclick={() => onstatus("all")}
    >
      {statusLabel}<span class="token-x" aria-hidden="true">✕</span>
    </button>
  {/if}

  {#if types.length > 2}
    <div
      bind:this={row}
      class="type-row"
      class:fade-start={fadeStart}
      class:fade-end={fadeEnd}
      role="group"
      aria-label="Type"
      onscroll={edges}
    >
      {#each chips as chip (chip.value)}
        {@const picked = chip.value === type}
        <button
          type="button"
          class="chip"
          class:picked
          aria-pressed={picked}
          aria-label={picked ? `${chip.label} ${chip.count}, remove filter` : undefined}
          disabled={chip.disabled}
          animate:flip={{ duration: ms }}
          transition:fade={{ duration: ms }}
          onclick={() => ontype(picked ? "all" : chip.value)}
        >
          {chip.label}
          <span class="chip-count">{chip.count}</span>
          {#if picked}<span class="token-x" aria-hidden="true">✕</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if isNarrow && sheetOpen}
  <Sheet label="Filters" focus="sheet" onclose={() => (sheetOpen = false)}>
    <LibraryFilterPanel {statuses} {types} {status} {type} {onstatus} {ontype} onreset={reset} />
  </Sheet>
{/if}

{#if !isNarrow}
  <div
    bind:this={panel}
    id={panelId}
    class="filter-popover"
    popover="auto"
    role="dialog"
    aria-label="Filters"
    ontoggle={(e) => (popoverOpen = (e as ToggleEvent).newState === "open")}
  >
    <LibraryFilterPanel {statuses} {types} {status} {type} {onstatus} {ontype} onreset={reset} />
  </div>
{/if}

<style lang="scss">
  .filter-bar {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    min-width: 0;
  }

  .filters-btn,
  .chip,
  .token {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    min-height: 36px;
    padding: $spacing-xs $spacing-md;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text-2);
    font-size: 0.8rem;
    white-space: nowrap;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: -2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .filters-btn {
    position: relative;

    svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
    }

    &.on {
      color: var(--clr-text);
      border-color: rgb(var(--clr-primary-rgb) / 0.5);
    }

    @include hover-capable {
      &:hover {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-width: $touch-target;
      justify-content: center;
    }

    // Narrow: the icon and its badge; the word stays in the accessible name.
    @include respond-to(md) {
      padding-inline: $spacing-sm;

      .filters-word {
        display: none;
      }
    }
  }

  .filters-badge {
    @include count-badge;
    background: var(--clr-primary);
    color: var(--clr-on-primary);

    @include respond-to(md) {
      position: absolute;
      top: -4px;
      right: -4px;
    }
  }

  // A mask reads only alpha: any opaque token keeps the chips, transparent fades them.
  .type-row {
    display: flex;
    gap: $spacing-xs;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
    scroll-snap-type: x proximity;

    &::-webkit-scrollbar {
      display: none;
    }

    &.fade-end {
      mask-image: linear-gradient(to right, rgb(var(--clr-ink-rgb)) 85%, transparent);
    }

    &.fade-start {
      mask-image: linear-gradient(to left, rgb(var(--clr-ink-rgb)) 85%, transparent);
    }

    &.fade-start.fade-end {
      mask-image: linear-gradient(
        to right,
        transparent,
        rgb(var(--clr-ink-rgb)) 12%,
        rgb(var(--clr-ink-rgb)) 88%,
        transparent
      );
    }
  }

  .chip {
    scroll-snap-align: start;

    @include hover-capable {
      &:hover:not(:disabled):not(.picked) {
        border-color: var(--clr-accent);
      }
    }

    &:disabled {
      opacity: 0.38;
      cursor: not-allowed;
    }
  }

  // An active filter: a filled accent token with a quiet cross.
  .token,
  .chip.picked {
    background: var(--clr-primary);
    border-color: transparent;
    color: var(--clr-on-primary);
    font-weight: 600;
  }

  .token-x {
    font-size: 0.7rem;
    opacity: 0.8;
  }

  .chip-count {
    @include count-badge;

    .picked & {
      background: rgb(var(--clr-on-primary-rgb) / 0.22);
      color: var(--clr-on-primary);
    }

    :disabled > & {
      background: rgb(var(--clr-ink-rgb) / 0.08);
      color: var(--clr-text-3);
    }
  }

  // Top-layer panel; left/top/max-height follow the Filters button while open.
  .filter-popover {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    width: min(22rem, calc(100vw - #{$spacing-md}));
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
    box-shadow: 0 12px 32px rgb(var(--clr-shade-rgb) / 0.35);
    color: inherit;
  }
</style>
