<script lang="ts">
  import ChartCard from "./ChartCard.svelte";
  import { formatHours } from "./chartTheme";
  import { plural } from "$lib/utils/format";
  import type { Streaks } from "$lib/domain/gamification";

  let {
    completed,
    inProgress,
    hours,
    streak,
  }: { completed: number; inProgress: number; hours: number; streak: Streaks } = $props();

  const tiles = $derived([
    { label: "Completed", value: String(completed), sub: "all time" },
    { label: "Streak", value: plural(streak.current, "day"), sub: `Longest ${streak.longest}` },
    { label: "Hours logged", value: formatHours(hours), sub: "from progress" },
    { label: "In progress", value: String(inProgress), sub: "right now" },
  ]);
</script>

<ChartCard id="stats" title="Stats" hideTitle area="stats">
  <div class="tiles">
    {#each tiles as tile (tile.label)}
      <div class="tile" role="group" aria-label={tile.label}>
        <span class="tile-label">{tile.label}</span>
        <span class="tile-value">{tile.value}</span>
        <span class="tile-sub">{tile.sub}</span>
      </div>
    {/each}
  </div>
</ChartCard>

<style lang="scss">
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr));
    gap: $spacing-sm;
    height: 100%;
  }

  .tile {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: $spacing-xs;
    min-width: 0;
    padding: $spacing-md;
    background: rgb(var(--clr-ink-rgb) / 0.04);
    border-radius: $radius-md;
  }

  .tile-label {
    @include label-style;
    color: var(--clr-text-3);
  }

  .tile-value {
    font-family: $font-display;
    font-size: clamp(2rem, 6vw, 2.6rem);
    line-height: 1.1;
    color: var(--clr-text);
  }

  .tile-sub {
    font-size: 0.8rem;
    color: var(--clr-text-3);
  }
</style>
