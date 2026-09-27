<script lang="ts">
  import { onMount } from "svelte";
  import "layerchart/core.css";
  import LevelCard from "./LevelCard.svelte";
  import StatTiles from "./StatTiles.svelte";
  import ProgressionCard from "./ProgressionCard.svelte";
  import ActivityCard from "./ActivityCard.svelte";
  import StatusCard from "./StatusCard.svelte";
  import TasteCard from "./TasteCard.svelte";
  import ForecastCard from "./ForecastCard.svelte";
  import { gamificationStore, GamificationStore } from "$lib/stores/gamification.svelte";

  // The store prop exists for tests; the app uses the singleton.
  let { store = gamificationStore }: { store?: GamificationStore } = $props();

  onMount(() => {
    store.load();
  });

  const showCharts = $derived(store.ready && !store.isEmpty);
</script>

<main class="profile">
  <h1 class="profile-title">Profile</h1>

  {#if store.error}
    <p class="profile-error" role="alert">{store.error}</p>
  {/if}

  <div class="dashboard" class:empty={!showCharts}>
    <LevelCard level={store.level} title={store.title} xp={store.xp} />
    {#if showCharts}
      <StatTiles
        completed={store.statuses.completed}
        inProgress={store.statuses.in_progress}
        hours={store.hours}
        streak={store.streak}
      />
      <ProgressionCard weeks={store.weeks} today={store.today} />
      <ActivityCard activity={store.activity} today={store.today} streak={store.streak} />
      <StatusCard counts={store.statuses} />
      <TasteCard families={store.families} />
      <ForecastCard
        backlog={store.backlog}
        weeks={store.weeks}
        pace={store.pace}
        eta={store.eta}
        nextLevel={store.level.level + 1}
      />
    {:else if store.ready}
      <p class="profile-empty">
        Save something to your library to start earning XP. Your progress, streak and forecast show
        up here.
      </p>
    {/if}
  </div>
</main>

<style lang="scss">
  .profile {
    @include page-shell;
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  .profile-title {
    @include page-title;
  }

  .dashboard {
    display: grid;
    gap: $spacing-md;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-areas:
      "level level level level stats stats stats stats stats stats stats stats"
      "progression progression progression progression progression progression progression progression activity activity activity activity"
      "library library library library taste taste taste taste forecast forecast forecast forecast";

    @include respond-to(lg) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-areas:
        "level stats"
        "progression progression"
        "activity library"
        "taste forecast";
    }

    @include respond-to(md) {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "level"
        "stats"
        "progression"
        "activity"
        "library"
        "taste"
        "forecast";
    }

    &.empty {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: "level" "hint";
      max-width: 40rem;
    }
  }

  // LayerChart reads these; its tooltip can be portaled outside the page, so it is global.
  .dashboard :global(.lc-root-container),
  :global(.lc-tooltip-root) {
    --color-primary: var(--clr-primary);
    --color-surface-100: var(--clr-surface-2);
    --color-surface-200: var(--clr-surface-2);
    --color-surface-300: var(--clr-surface-2);
    --color-surface-content: var(--clr-text);
  }

  .profile-empty {
    grid-area: hint;
    color: var(--clr-text-2);
  }

  .profile-error {
    color: var(--clr-error);
  }
</style>
