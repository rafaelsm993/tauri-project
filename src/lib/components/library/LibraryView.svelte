<script lang="ts">
  import { resolve } from "$app/paths";
  import LibraryCard from "$lib/components/library/LibraryCard.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import { libraryStore, LibraryStore, STATUS_LABELS } from "$lib/stores/library.svelte";
  import { libraryFilters, LibraryFilters } from "$lib/stores/ui.svelte";
  import {
    filterEntries,
    searchEntries,
    statusOptions,
    typeOptions,
  } from "$lib/domain/libraryView";

  // The store and filters props exist for tests; the app uses the singletons.
  let {
    store = libraryStore,
    filters = libraryFilters,
  }: { store?: LibraryStore; filters?: LibraryFilters } = $props();

  const matching = $derived(searchEntries(store.entries, filters.query));
  const types = $derived(typeOptions(matching, store.entries));
  // A kept type whose last entry was removed would otherwise hide everything.
  const type = $derived(types.some((t) => t.value === filters.type) ? filters.type : "all");
  const status = $derived(filters.status);
  const visible = $derived(filterEntries(matching, { status, type }));
  const statuses = $derived(statusOptions(matching, type));
  const emptyFilterText = $derived.by(() => {
    if (matching.length === 0) return `No titles match \u201c${filters.query.trim()}\u201d.`;
    return status === "all"
      ? "No items of this type."
      : `No ${STATUS_LABELS[status].toLowerCase()} items.`;
  });
</script>

<main class="library">
  <header class="library-head">
    <h1 class="library-title">Library</h1>
    {#if store.entries.length > 0}
      <div class="library-filters">
        <SearchField
          label="Search your library"
          placeholder="Search by title"
          value={filters.query}
          onchange={(v) => (filters.query = v)}
        />
        <SegmentedControl
          label="Status"
          options={statuses}
          value={status}
          onchange={(v) => (filters.status = v)}
        />
        {#if types.length > 2}
          <SegmentedControl
            label="Type"
            options={types}
            value={type}
            onchange={(v) => (filters.type = v)}
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
    @include page-shell;
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  .library-head,
  .library-filters {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    min-width: 0;
  }

  .library-title {
    @include page-title;
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
