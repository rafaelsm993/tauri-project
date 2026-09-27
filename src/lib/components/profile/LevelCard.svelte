<script lang="ts">
  import { ArcChart, Text } from "layerchart";
  import ChartCard from "./ChartCard.svelte";
  import { XP_COLOR } from "./chartTheme";
  import type { LevelInfo, Title } from "$lib/domain/gamification";

  let { level, title, xp }: { level: LevelInfo; title: Title; xp: number } = $props();

  const series = $derived([
    { key: "xp", color: XP_COLOR, data: [{ key: "xp", value: level.into }] },
  ]);
  const toNext = $derived(level.needed - level.into);
</script>

<ChartCard id="level" title="Level" hideTitle area="level">
  <div class="level">
    <div
      class="ring"
      role="img"
      aria-label="Level {level.level}, {level.into} of {level.needed} XP"
    >
      <ArcChart
        label="key"
        value="value"
        outerRadius={-6}
        innerRadius={-12}
        range={[90, -270]}
        maxValue={level.needed}
        cornerRadius={20}
        {series}
        props={{ arc: { track: { fill: "rgb(var(--clr-ink-rgb) / 0.08)" }, motion: "tween" } }}
        tooltipContext={false}
      >
        {#snippet aboveMarks()}
          <Text
            value={String(level.level)}
            textAnchor="middle"
            verticalAnchor="middle"
            class="ring-number"
            dy={-6}
          />
          <Text
            value="LEVEL"
            textAnchor="middle"
            verticalAnchor="middle"
            class="ring-label"
            dy={28}
          />
        {/snippet}
      </ArcChart>
    </div>
    <div class="level-text">
      <p class="level-title">{title.name}</p>
      <p class="level-xp">{xp} XP · {toNext} XP to level {level.level + 1}</p>
      {#if title.next}
        <p class="level-next">Next title: {title.next.name} at level {title.next.level}</p>
      {/if}
    </div>
  </div>
</ChartCard>

<style lang="scss">
  .level {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: $spacing-md $spacing-lg;
    height: 100%;
  }

  .ring {
    width: clamp(9rem, 40vw, 11rem);
    aspect-ratio: 1;
  }

  .ring :global(.ring-number) {
    font-family: $font-display;
    font-size: 3.4rem;
    fill: var(--clr-text);
  }

  .ring :global(.ring-label) {
    font-family: $font-mono;
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    fill: var(--clr-text-3);
  }

  .level-text {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
    text-align: center;
  }

  .level-title {
    font-family: $font-display;
    font-size: clamp(1.8rem, 6vw, 2.4rem);
    line-height: 1;
    letter-spacing: 0.03em;
    color: var(--clr-primary);
  }

  .level-xp {
    font-family: $font-mono;
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .level-next {
    font-size: 0.85rem;
    color: var(--clr-text-3);
  }
</style>
