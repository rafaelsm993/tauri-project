<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import "layerchart/core.css";
  import LevelCard from "./LevelCard.svelte";
  import StatTiles from "./StatTiles.svelte";
  import ProgressionCard from "./ProgressionCard.svelte";
  import ActivityCard from "./ActivityCard.svelte";
  import StatusCard from "./StatusCard.svelte";
  import TasteCard from "./TasteCard.svelte";
  import ForecastCard from "./ForecastCard.svelte";
  import { gamificationStore, GamificationStore } from "$lib/stores/gamification.svelte";
  import { motionStore } from "$lib/stores/motion.svelte";

  // `store` and `motion` exist for tests; the app follows the OS and the saved setting.
  let { store = gamificationStore, motion }: { store?: GamificationStore; motion?: boolean } =
    $props();

  const moves = $derived(motion ?? motionStore.on);

  // The layout loads the log once and live saves keep it current; a visit only moves the day.
  onMount(() => {
    if (store.ready) store.refreshDay();
    else store.load();
  });

  // The app may stay open past midnight; "today" moves when you come back to it.
  function onReturn() {
    if (document.visibilityState === "visible") store.refreshDay();
  }

  const showCharts = $derived(store.ready && !store.isEmpty);
</script>

<svelte:window onfocus={onReturn} />
<svelte:document onvisibilitychange={onReturn} />

<main class="profile">
  <header class="profile-header">
    <h1 class="profile-title">Profile</h1>
    <a class="profile-settings" href={resolve("/settings")}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.1z"
        />
      </svg>
      Settings
    </a>
  </header>

  {#if store.error}
    <ErrorNote message={store.error} />
  {/if}

  <div class="dashboard" class:empty={!showCharts}>
    <LevelCard
      level={store.level}
      title={store.title}
      xp={store.xp}
      burst={store.burst && moves}
      onburstend={() => store.burstDone()}
    />
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

  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    min-width: 0;
  }

  .profile-title {
    @include page-title;
    flex: 1 1 auto;
    min-width: 0;
  }

  // Phones have no Settings tab; desktop has it in the rail.
  .profile-settings {
    display: none;
    align-items: center;
    gap: $spacing-sm;
    min-height: $touch-target;
    padding: 0 $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    color: var(--clr-text-2);
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;

    svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    @include respond-to(md) {
      display: inline-flex;
    }
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
</style>
