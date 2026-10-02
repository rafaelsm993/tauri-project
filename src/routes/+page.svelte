<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { MediaItem } from "$lib/types/media";
  import { BrowseStore } from "$lib/stores/browse.svelte";
  import { onReconnect } from "$lib/stores/online.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import CategoryTabs from "$lib/components/ui/CategoryTabs.svelte";
  import TodayStrip from "$lib/components/planner/TodayStrip.svelte";
  import { reminderStore } from "$lib/stores/reminders.svelte";
  import GenreCarousel from "$lib/components/ui/GenreCarousel.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import BackToTop from "$lib/components/ui/BackToTop.svelte";
  import MultiSelect from "$lib/components/ui/MultiSelect.svelte";
  import BrowseContext from "$lib/components/browse/BrowseContext.svelte";
  import ResultsGrid from "$lib/components/browse/ResultsGrid.svelte";
  import { whenVisible } from "$lib/attachments/whenVisible";

  const browse = new BrowseStore();

  // Carousels start loading about one screen before they scroll into view.
  const PRELOAD_MARGIN = "100% 0px";

  const genreName = $derived(
    browse.activeGenre === null
      ? null
      : (browse.genres.find((g) => g.id === browse.activeGenre)?.name ?? "genre"),
  );

  let typed = $state("");

  // Both clear paths empty the field; only a submitted search has results to drop.
  function clearSearch() {
    typed = "";
    if (browse.isSearch) void browse.clearSearch();
  }

  function openDetail(item: MediaItem) {
    goto(
      resolve("/media/[type]/[id]", {
        type: item.media_type,
        id: encodeURIComponent(String(item.id)),
      }),
    );
  }

  onMount(() => {
    browse.refreshView();
  });

  // Carousels or a grid that failed while offline load again once the network returns.
  onReconnect(() => browse.retryFailed());
</script>

<div class="page">
  <header class="page-header">
    <div class="search-slot">
      <SearchField
        mode="submit"
        label="Search the catalog"
        placeholder="Search movies, TV, anime, manga, books, games…"
        value={typed}
        loading={browse.loading && browse.isSearch}
        onchange={(v) => (typed = v)}
        onsubmit={(q) => browse.search(q)}
        onclear={clearSearch}
      />
    </div>

    <CategoryTabs active={browse.activeCategory} onchange={(c) => browse.switchCategory(c)}>
      {#snippet trailing()}
        {#if browse.carouselMode && browse.genres.length > 0}
          <MultiSelect
            label="Genres"
            options={browse.genreOptions}
            selected={browse.selectedGenres}
            onchange={(ids) => browse.setSelectedGenres(ids)}
          />
        {/if}
      {/snippet}
    </CategoryTabs>
    <TodayStrip
      today={reminderStore.data}
      busy={(key) => reminderStore.busy(key)}
      ondone={(key) => void reminderStore.done(key)}
      onnext={(key) => void reminderStore.nextSession(key)}
    />
  </header>

  <div class="page-body">
    <main class="main-col">
      <BrowseContext
        isSearch={browse.isSearch}
        query={browse.query}
        {genreName}
        onClearSearch={clearSearch}
        onAllGenres={() => browse.switchGenre(null)}
      />

      {#if browse.error && browse.gridMode}
        <div class="page-error">
          <ErrorNote message={browse.error} onretry={() => browse.retryFailed()} />
        </div>
      {/if}

      {#if !browse.gridMode}
        {#each browse.visibleSections as section (section.genre.id)}
          <div
            class="carousel-slot"
            {@attach whenVisible(() => browse.loadSection(section.genre.id), {
              rootMargin: PRELOAD_MARGIN,
            })}
          >
            <GenreCarousel
              title={section.genre.name}
              items={section.items}
              loading={section.loading}
              error={section.error}
              onCardClick={openDetail}
              onSeeMore={() => browse.switchGenre(section.genre.id)}
              onRetry={() => browse.retrySection(section.genre.id)}
            />
          </div>
        {/each}
      {:else}
        <ResultsGrid
          items={browse.items}
          loading={browse.loading}
          appending={browse.appending}
          hasMore={browse.hasMore}
          hasError={!!browse.error}
          onCardClick={openDetail}
          onLoadMore={() => browse.loadMore()}
        />
      {/if}
    </main>
  </div>
</div>

<BackToTop />

<style lang="scss">
  .page {
    @include page-shell;
    overflow-x: clip; // contain any wide carousel rail
  }

  // ── Header ──────────────────────────────────────────────
  .page-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-sm;
    padding-bottom: $spacing-lg;
  }

  .search-slot {
    display: flex;
    justify-content: center;
    width: 100%;
    min-width: 0;
  }

  // ── Body: single column ─────────────────────────────────
  .page-body {
    display: flex;
    min-width: 0;
  }

  .main-col {
    flex: 1 1 auto;
    min-width: 0; // critical: lets carousel rails overflow:auto kick in
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }

  // Wrapper that carries the lazy-load observer. Loading carousels render
  // full-height skeletons, so only the first few slots start near the viewport.
  .carousel-slot {
    min-width: 0;
  }

  // ── States ──────────────────────────────────────────────
  .page-error {
    margin-bottom: $spacing-md;
  }
</style>
