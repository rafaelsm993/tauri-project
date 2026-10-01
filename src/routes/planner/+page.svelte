<script lang="ts">
  import PlannerView from "$lib/components/planner/PlannerView.svelte";
  import { localDay } from "$lib/domain/calendar";
</script>

<svelte:head><title>Planner · Aevum</title></svelte:head>

<PlannerView today={localDay()} />
