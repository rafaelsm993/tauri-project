<script lang="ts">
  import { AreaChart } from "layerchart";
  import ChartCard from "./ChartCard.svelte";
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import { FAMILY_COLORS, shortDate, toDate } from "./chartTheme";
  import {
    cumulative,
    FAMILIES,
    FAMILY_LABELS,
    inRange,
    RANGES,
    type RangeValue,
    type WeekPoint,
    withBaseline,
  } from "$lib/domain/dashboard";

  let { weeks, today }: { weeks: WeekPoint[]; today: string } = $props();

  let range = $state<RangeValue>("90");

  const days = $derived(RANGES.find((r) => r.value === range)?.days ?? null);
  const shown = $derived(inRange(cumulative(withBaseline(weeks)), days, today));
  const data = $derived(shown.map((w) => ({ ...w, date: toDate(w.week) })));
  const used = $derived(FAMILIES.filter((f) => shown.some((w) => w[f] > 0)));
  const series = $derived(
    used.map((f) => ({ key: f, label: FAMILY_LABELS[f], color: FAMILY_COLORS[f] })),
  );
</script>

<ChartCard
  id="progression"
  title="Progression"
  hint="Total XP over time, by family"
  area="progression"
>
  {#snippet action()}
    <SegmentedControl
      label="Range"
      options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
      value={range}
      onchange={(v) => (range = v)}
    />
  {/snippet}
  <div class="chart" aria-hidden="true">
    <AreaChart
      {data}
      x="date"
      {series}
      seriesLayout="stack"
      legend
      props={{
        area: { fillOpacity: 0.35, motion: "tween" },
        xAxis: { format: shortDate },
      }}
    />
  </div>
  <table class="sr">
    <caption>Total XP at the start of each week</caption>
    <thead><tr><th>Week</th><th>XP</th></tr></thead>
    <tbody>
      {#each shown as w (w.week)}
        <tr><td>{w.week}</td><td>{w.total}</td></tr>
      {/each}
    </tbody>
  </table>
</ChartCard>

<style lang="scss">
  .chart {
    height: clamp(14rem, 40vw, 18rem);
    min-width: 0;
  }

  .sr {
    @include sr-only;
  }
</style>
