<script lang="ts">
  import PlannerView from "$lib/components/planner/PlannerView.svelte";
  import { localDay } from "$lib/domain/calendar";
</script>

<svelte:head><title>Planner · SESH</title></svelte:head>

<PlannerView today={localDay()} />
