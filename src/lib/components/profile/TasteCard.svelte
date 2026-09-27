<script lang="ts">
  import { LineChart } from "layerchart";
  import ChartCard from "./ChartCard.svelte";
  import { formatHours, XP_COLOR } from "./chartTheme";
  import { FAMILIES, FAMILY_LABELS, type Family, type FamilyStats } from "$lib/domain/dashboard";

  let { families }: { families: Record<Family, FamilyStats> } = $props();

  const data = $derived(
    FAMILIES.map((f) => ({ family: FAMILY_LABELS[f], items: families[f].items })),
  );
  // Headroom keeps the outermost points clear of the axis labels.
  const top = $derived(Math.max(1, ...data.map((d) => d.items)) * 1.35);
</script>

<ChartCard id="taste" title="Taste" hint="Items saved per family" area="taste">
  <div class="radar" aria-hidden="true">
    <LineChart
      {data}
      x="family"
      y="items"
      radial
      points
      yDomain={[0, top]}
      padding={{ top: 20, bottom: 20, left: 56, right: 56 }}
      series={[{ key: "items", label: "Items", color: XP_COLOR }]}
      props={{
        spline: { fill: "rgb(var(--clr-primary-rgb) / 0.2)", motion: "tween" },
        xAxis: { tickLength: 0 },
        yAxis: { format: () => "" },
        grid: { radialY: "linear" },
        tooltip: { context: { mode: "voronoi" } },
        highlight: { lines: false },
      }}
    />
  </div>
  <table class="sr">
    <caption>Items, completions and hours per family</caption>
    <thead><tr><th>Family</th><th>Items</th><th>Completed</th><th>Hours</th></tr></thead>
    <tbody>
      {#each FAMILIES as f (f)}
        <tr>
          <td>{FAMILY_LABELS[f]}</td>
          <td>{families[f].items}</td>
          <td>{families[f].completed}</td>
          <td>{formatHours(families[f].hours)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</ChartCard>

<style lang="scss">
  .radar {
    height: 15rem;
    min-width: 0;
  }

  .sr {
    @include sr-only;
  }
</style>
