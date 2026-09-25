<script lang="ts">
  import { resolve } from "$app/paths";
  import LibraryCard from "$lib/components/library/LibraryCard.svelte";
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import { libraryStore, LibraryStore, STATUS_LABELS } from "$lib/stores/library.svelte";
  import {
    filterEntries,
    statusOptions,
    typeOptions,
    type StatusFilter,
    type TypeFilter,
  } from "$lib/domain/libraryView";

  // The store prop exists for tests; the app uses the singleton.
  let { store = libraryStore }: { store?: LibraryStore } = $props();

  let status = $state<StatusFilter>("all");
  let type = $state<TypeFilter>("all");

  const visible = $derived(filterEntries(store.entries, { status, type }));
  const statuses = $derived(statusOptions(store.entries, type));
  const types = $derived(typeOptions(store.entries));
  const emptyFilterText = $derived(
    status === "all"
      ? "No items of this type."
      : `No ${STATUS_LABELS[status].toLowerCase()} items.`,
  );
</script>

<main class="library">
  <header class="library-head">
    <h1 class="library-title">Library</h1>
    {#if store.entries.length > 0}
      <div class="library-filters">
        <SegmentedControl
          label="Status"
          options={statuses}
          value={status}
          onchange={(v) => (status = v)}
        />
        {#if types.length > 2}
          <SegmentedControl
            label="Type"
            options={types}
            value={type}
            onchange={(v) => (type = v)}
          />
        {/if}
      </div>
    {/if}
  </header>

  {#if store.error}
    <p class="library-error" role="alert">⚠ {store.error}</p>
  {/if}

  {#if !store.ready && !store.error}
    <p class="library-note" aria-busy="true">Loading your library…</p>
  {:else if store.entries.length === 0}
    <div class="library-empty">
      <p>Nothing saved yet.</p>
      <a class="library-link" href={resolve("/")}>Browse the catalog</a>
    </div>
  {:else if visible.length === 0}
    <p class="library-note">{emptyFilterText}</p>
  {:else}
    <ul class="library-grid">
      {#each visible as entry (entry.key)}
        <li><LibraryCard {entry} posterDir={store.posterDir} /></li>
      {/each}
    </ul>
  {/if}
</main>

<style lang="scss">
  .library {
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
    padding: $spacing-lg clamp(#{$spacing-md}, 4vw, #{$spacing-2xl});
    min-width: 0;
  }

  .library-head,
  .library-filters {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    min-width: 0;
  }

  // Same height as the profile button, so the title sits level with it and content starts below.
  .library-title {
    display: flex;
    align-items: center;
    min-height: $bar-height;
    padding-inline-end: calc(#{$bar-height} + #{$spacing-sm});
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--clr-text);
  }

  .library-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(clamp(120px, 14vw, 180px), 1fr));
    gap: $spacing-lg $spacing-md;

    > li {
      min-width: 0;
    }
  }

  .library-note,
  .library-empty {
    color: var(--clr-text-2);
    font-size: 0.9rem;
  }

  .library-empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-sm;
  }

  .library-link {
    color: var(--clr-accent);

    @include touch {
      min-height: $touch-target;
      display: inline-flex;
      align-items: center;
    }
  }

  .library-error {
    color: var(--clr-error);
    font-size: 0.85rem;
  }
</style>
