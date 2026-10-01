<script lang="ts">
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import type { Day } from "$lib/domain/planner";
  import { formatDay, formatMinutes } from "$lib/utils/format";

  // `motion` follows the background-animation setting and reduce-motion; the caller decides.
  let { days, today, motion }: { days: Day[]; today: string; motion: boolean } = $props();

  const duration = $derived(motion ? 220 : 0);

  // On a week narrower than its seven columns, bring today to the start without moving the page.
  function reveal(day: HTMLElement) {
    const week = day.parentElement;
    if (!week || week.scrollWidth <= week.clientWidth) return;
    const offset = day.getBoundingClientRect().left - week.getBoundingClientRect().left;
    week.scrollLeft += offset;
  }
</script>

<ol class="week" aria-label="Week">
  {#each days as day (day.date)}
    <li
      class="day"
      class:past={day.date < today}
      class:today={day.date === today}
      aria-label={formatDay(day.date)}
      aria-current={day.date === today ? "date" : undefined}
      {@attach day.date === today ? reveal : undefined}
    >
      <div class="day-head">
        <span class="day-name" aria-hidden="true">{formatDay(day.date)}</span>
        {#if day.total > 0}
          <span class="day-total">{formatMinutes(day.total)}</span>
        {/if}
      </div>
      <ul class="blocks">
        {#each day.blocks as block (block.id)}
          <li
            class="block hue-{block.family}"
            aria-label="{block.title}, {formatMinutes(block.minutes)}"
            animate:flip={{ duration }}
            transition:fade={{ duration }}
          >
            <span class="block-title" aria-hidden="true">{block.title}</span>
            <span class="block-minutes" aria-hidden="true">{formatMinutes(block.minutes)}</span>
          </li>
        {:else}
          <li class="free">Free</li>
        {/each}
      </ul>
    </li>
  {/each}
</ol>

<style lang="scss">
  .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: $spacing-sm;
    list-style: none;
    padding: 0;
    margin: 0;

    @include respond-to(lg) {
      grid-template-columns: repeat(7, minmax(7.5rem, 1fr));
      overflow-x: auto;
      scroll-snap-type: x proximity;
      padding-bottom: $spacing-xs;
    }
  }

  .day {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
    padding: $spacing-sm;
    border-radius: $radius-md;
    background: var(--clr-surface);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.06);
    scroll-snap-align: start;

    &.today {
      border-color: var(--clr-accent);
    }

    &.past {
      opacity: 0.55;
    }
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    gap: $spacing-xs;
    flex-wrap: wrap;
    font-size: 0.75rem;
  }

  .day-name {
    font-family: $font-mono;
    color: var(--clr-text-2);
  }

  .today .day-name {
    color: var(--clr-accent);
    font-weight: 600;
  }

  .day-total {
    color: var(--clr-text-3);
  }

  .blocks {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .block {
    --hue: var(--clr-primary-rgb);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    background: rgb(var(--hue) / 0.18);
    border-inline-start: 3px solid rgb(var(--hue));
    font-size: 0.78rem;

    @include touch {
      min-height: $touch-target;
      justify-content: center;
    }
  }

  .hue-screen {
    --hue: var(--clr-hue-screen-rgb);
  }

  .hue-anime {
    --hue: var(--clr-hue-anime-rgb);
  }

  .hue-manga {
    --hue: var(--clr-hue-manga-rgb);
  }

  .hue-book {
    --hue: var(--clr-hue-book-rgb);
  }

  .hue-game {
    --hue: var(--clr-hue-game-rgb);
  }

  .block-title {
    color: var(--clr-text);
    overflow-wrap: anywhere;
  }

  .block-minutes {
    color: var(--clr-text-2);
    font-family: $font-mono;
    font-size: 0.72rem;
  }

  .free {
    font-size: 0.75rem;
    color: var(--clr-text-3);
  }
</style>
