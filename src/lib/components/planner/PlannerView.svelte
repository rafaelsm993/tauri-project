<script lang="ts">
  import { resolve } from "$app/paths";
  import { untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import PlanDialog from "./PlanDialog.svelte";
  import WeekTimeline from "./WeekTimeline.svelte";
  import { addDays, weekStart } from "$lib/domain/calendar";
  import { DEFAULT_PAGES_PER_HOUR } from "$lib/domain/estimate";
  import { LENGTH_LABELS } from "$lib/domain/length";
  import { plannerData, weekView } from "$lib/domain/planner";
  import { libraryStore, LibraryStore } from "$lib/stores/library.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import { formatDay } from "$lib/utils/format";
  import type { LibraryEntry } from "$lib/types/library";

  const reduced = new MediaQuery("prefers-reduced-motion: reduce");

  // `library`, `prefs`, `today` and `motion` exist for tests; the route passes today's local date.
  let {
    today,
    library = libraryStore,
    prefs = prefsStore,
    motion,
  }: { today: string; library?: LibraryStore; prefs?: PrefsStore; motion?: boolean } = $props();

  const moves = $derived(
    motion ?? (prefs.ready && prefs.prefs.background_animation && !reduced.current),
  );

  let weekOf = $state(untrack(() => today));
  let editing = $state<LibraryEntry | null>(null);

  const pace = $derived(prefs.prefs.reading_pages_per_hour ?? DEFAULT_PAGES_PER_HOUR);
  const data = $derived(plannerData(library.entries, today, pace));
  const days = $derived(weekView(data.planned, weekOf));
  const monday = $derived(weekStart(weekOf));
  const isThisWeek = $derived(monday === weekStart(today));
  const empty = $derived(data.planned.length === 0 && data.needs.length === 0);
</script>

<main class="planner">
  <h1 class="planner-title">Planner</h1>

  {#if library.ready && empty}
    <p class="planner-empty">
      Nothing planned yet. Open an item in your
      <a href={resolve("/library")}>library</a> and choose Plan to pick your days and session length.
    </p>
  {:else}
    <section class="week-section" aria-labelledby="week-heading">
      <div class="week-bar">
        <h2 id="week-heading" class="section-title">Week of {formatDay(monday)}</h2>
        <div class="week-nav">
          <button type="button" class="nav-btn" onclick={() => (weekOf = addDays(weekOf, -7))}>
            <span aria-hidden="true">←</span><span class="nav-text">Previous week</span>
          </button>
          <button
            type="button"
            class="nav-btn"
            disabled={isThisWeek}
            onclick={() => (weekOf = today)}
          >
            This week
          </button>
          <button type="button" class="nav-btn" onclick={() => (weekOf = addDays(weekOf, 7))}>
            <span class="nav-text">Next week</span><span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <WeekTimeline {days} {today} motion={moves} />
    </section>

    {#if editing}
      <PlanDialog entry={editing} {today} {library} {prefs} onclose={() => (editing = null)} />
    {/if}

    {#if data.planned.length > 0}
      <section class="list-section">
        <h2 class="section-title">Plans</h2>
        <ul class="plan-list" aria-label="Plans">
          {#each data.planned as item (item.entry.key)}
            <li class="plan-row hue-{item.family}">
              <span class="plan-title">{item.entry.snapshot.title}</span>
              <span class="plan-finish">Finishes {formatDay(item.finish)}</span>
              <button
                type="button"
                class="row-btn"
                aria-label="Edit {item.entry.snapshot.title}"
                onclick={() => (editing = item.entry)}
              >
                Edit
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if data.needs.length > 0}
      <section class="list-section">
        <h2 class="section-title">Needs a length</h2>
        <ul class="plan-list" aria-label="Needs a length">
          {#each data.needs as item (item.entry.key)}
            <li class="plan-row">
              <span class="plan-title">{item.entry.snapshot.title}</span>
              <span class="plan-finish">
                Add {item.missing.map((f) => LENGTH_LABELS[f].toLowerCase()).join(" and ")}
              </span>
              <button
                type="button"
                class="row-btn"
                aria-label="Plan {item.entry.snapshot.title}"
                onclick={() => (editing = item.entry)}
              >
                Plan this
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</main>

<style lang="scss">
  .planner {
    @include page-shell;
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  .planner-title {
    @include page-title;
  }

  .planner-empty {
    max-width: 40rem;
    color: var(--clr-text-2);

    a {
      color: var(--clr-accent);
    }
  }

  .week-section,
  .list-section {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    min-width: 0;
  }

  .week-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
  }

  .section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .week-nav {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
  }

  .nav-btn,
  .row-btn {
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.8rem;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover:not(:disabled) {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
      min-width: $touch-target;
      justify-content: center;
    }
  }

  .nav-text {
    @include respond-to(sm) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  .plan-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .plan-row {
    --hue: var(--clr-ink-rgb);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-md;
    background: var(--clr-surface);
    border-inline-start: 3px solid rgb(var(--hue) / 0.8);

    @include respond-to(sm) {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "title btn" "finish btn";
    }
  }

  .hue-screen {
    --hue: var(--clr-hue-screen-rgb);
  }

  .hue-anime {
    --hue: var(--clr-hue-anime-rgb);
  }

  .hue-manga {
    --hue: var(--clr-hue-manga-rgb);
  }

  .hue-book {
    --hue: var(--clr-hue-book-rgb);
  }

  .hue-game {
    --hue: var(--clr-hue-game-rgb);
  }

  .plan-title {
    color: var(--clr-text);
    overflow-wrap: anywhere;

    @include respond-to(sm) {
      grid-area: title;
    }
  }

  .plan-finish {
    font-size: 0.8rem;
    color: var(--clr-text-2);

    @include respond-to(sm) {
      grid-area: finish;
    }
  }

  .row-btn {
    @include respond-to(sm) {
      grid-area: btn;
    }
  }
</style>
