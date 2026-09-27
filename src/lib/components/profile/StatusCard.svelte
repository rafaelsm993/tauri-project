<script lang="ts">
  import { PieChart, Text } from "layerchart";
  import ChartCard from "./ChartCard.svelte";
  import { STATUS_COLORS } from "./chartTheme";
  import { STATUSES, STATUS_LABELS } from "$lib/stores/library.svelte";
  import { plural } from "$lib/utils/format";
  import type { LibraryStatus } from "$lib/types/library";

  let { counts }: { counts: Record<LibraryStatus, number> } = $props();

  const data = $derived(
    STATUSES.filter((s) => counts[s] > 0).map((s) => ({
      status: s,
      label: STATUS_LABELS[s],
      count: counts[s],
    })),
  );
  const total = $derived(data.reduce((sum, d) => sum + d.count, 0));
  const summary = $derived(
    `${plural(total, "item")}: ` +
      data.map((d) => `${d.count} ${d.label.toLowerCase()}`).join(", "),
  );
</script>

<ChartCard id="library-mix" title="Library" hint="Items by status" area="library">
  {#if total === 0}
    <p class="empty-note">Your library is empty. Your XP and history stay.</p>
  {:else}
    <div class="donut" role="img" aria-label={summary}>
      <PieChart
        {data}
        key="status"
        label="label"
        value="count"
        c="status"
        cDomain={data.map((d) => d.status)}
        cRange={data.map((d) => STATUS_COLORS[d.status])}
        innerRadius={-18}
        cornerRadius={4}
        padAngle={0.02}
        legend
        props={{ pie: { motion: "tween" } }}
      >
        {#snippet aboveMarks()}
          <Text
            value={String(total)}
            textAnchor="middle"
            verticalAnchor="middle"
            class="donut-total"
          />
        {/snippet}
      </PieChart>
    </div>
  {/if}
</ChartCard>

<style lang="scss">
  .donut {
    height: 15rem;
    min-width: 0;
  }

  .empty-note {
    font-size: 0.9rem;
    color: var(--clr-text-2);
  }

  .donut :global(.donut-total) {
    font-family: $font-display;
    font-size: 2.4rem;
    fill: var(--clr-text);
  }
</style>
