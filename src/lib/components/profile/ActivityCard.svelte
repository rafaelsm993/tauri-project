<script lang="ts">
  import ChartCard from "./ChartCard.svelte";
  import { heatmapWeeks } from "$lib/domain/dashboard";
  import { plural } from "$lib/utils/format";
  import type { Streaks } from "$lib/domain/gamification";

  let {
    activity,
    today,
    streak,
  }: { activity: Map<string, number>; today: string; streak: Streaks } = $props();

  const WEEKS = 16;

  const grid = $derived(heatmapWeeks(activity, today, WEEKS));
  const active = $derived(grid.flat().filter((d) => d.count > 0).length);

  // Four steps of intensity; 0 is an empty day.
  const level = (count: number): number => (count === 0 ? 0 : Math.min(4, Math.ceil(count / 3)));
</script>

<ChartCard
  id="activity"
  title="Activity"
  hint="{plural(streak.current, 'day')} in a row · longest {streak.longest}"
  area="activity"
>
  <div
    class="heatmap"
    role="img"
    aria-label="{plural(active, 'active day')} in the last {WEEKS} weeks"
  >
    {#each grid as week (week[0].date)}
      {#each week as day (day.date)}
        <span
          class="cell l{level(day.count)}"
          class:future={day.future}
          title="{day.date}: {plural(day.count, 'action')}"
        ></span>
      {/each}
    {/each}
  </div>
  <p class="heat-legend" aria-hidden="true">
    Less
    {#each [0, 1, 2, 3, 4] as l (l)}<span class="cell l{l}"></span>{/each}
    More
  </p>
</ChartCard>

<style lang="scss">
  .heatmap {
    display: grid;
    grid-template-rows: repeat(7, auto);
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 3px;
    min-width: 0;
  }

  .cell {
    display: block;
    aspect-ratio: 1;
    border-radius: 3px;
    background: rgb(var(--clr-ink-rgb) / 0.06);

    &.l1 {
      background: rgb(var(--clr-teal-rgb) / 0.3);
    }
    &.l2 {
      background: rgb(var(--clr-teal-rgb) / 0.5);
    }
    &.l3 {
      background: rgb(var(--clr-teal-rgb) / 0.75);
    }
    &.l4 {
      background: var(--clr-teal);
    }
    &.future {
      visibility: hidden;
    }
  }

  .heat-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    font-size: 0.75rem;
    color: var(--clr-text-3);

    .cell {
      width: 0.7rem;
    }
  }
</style>
