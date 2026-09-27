<script lang="ts">
  import { LineChart } from "layerchart";
  import ChartCard from "./ChartCard.svelte";
  import { formatHours, shortDate, toDate, XP_COLOR } from "./chartTheme";
  import { forecastLine, type Backlog, type WeekPoint } from "$lib/domain/dashboard";
  import { plural } from "$lib/utils/format";

  let {
    backlog,
    weeks,
    pace,
    eta,
    nextLevel,
  }: {
    backlog: Backlog;
    weeks: WeekPoint[];
    pace: number;
    eta: number | null;
    nextLevel: number;
  } = $props();

  const AHEAD = 4;

  const line = $derived(forecastLine(weeks, pace, AHEAD));
  const actual = $derived(
    line.filter((p) => p.actual !== null).map((p) => ({ date: toDate(p.week), xp: p.actual })),
  );
  const projected = $derived(
    line
      .filter((p) => p.projected !== null)
      .map((p) => ({ date: toDate(p.week), xp: p.projected })),
  );
  const series = $derived([
    { key: "actual", label: "XP", color: XP_COLOR, data: actual },
    {
      key: "projected",
      label: "At this pace",
      color: "var(--clr-text-3)",
      data: projected,
      props: { "stroke-dasharray": "6 5" },
    },
  ]);
  const untracked = $derived(backlog.unknown === 1 ? "has" : "have");
</script>

<ChartCard id="forecast" title="Forecast" hint="From your last 30 days" area="forecast">
  <dl class="facts">
    <div class="fact">
      <dt>Backlog</dt>
      <dd>
        <span class="fact-value">{formatHours(backlog.hours)}<span class="unit">hours</span></span>
        <span class="fact-sub">left on {plural(backlog.items, "item")}</span>
      </dd>
    </div>
    <div class="fact">
      <dt>Next level</dt>
      <dd class="fact-sub">
        {#if eta === null}
          Log something to see when you reach level {nextLevel}.
        {:else}
          Level {nextLevel} in about {plural(eta, "day")}
        {/if}
      </dd>
    </div>
  </dl>
  {#if backlog.unknown > 0}
    <p class="note">
      {plural(backlog.unknown, "item")}
      {untracked} no length yet, so {backlog.unknown === 1 ? "it isn't" : "they aren't"} counted.
    </p>
  {/if}
  {#if actual.length > 0}
    <div class="chart" aria-hidden="true">
      <LineChart
        x="date"
        y="xp"
        {series}
        legend
        props={{ spline: { motion: "tween" }, xAxis: { format: shortDate, ticks: 3 } }}
      />
    </div>
  {/if}
</ChartCard>

<style lang="scss">
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-md $spacing-lg;
  }

  .fact {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    dt {
      @include label-style;
      color: var(--clr-text-3);
    }
  }

  .fact-value {
    display: block;
    font-family: $font-display;
    font-size: 2rem;
    line-height: 1.1;
    color: var(--clr-text);
  }

  .unit {
    margin-left: $spacing-xs;
    font-family: $font-body;
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .fact-sub,
  .note {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .note {
    color: var(--clr-text-3);
  }

  .chart {
    height: 10rem;
    min-width: 0;
  }
</style>
