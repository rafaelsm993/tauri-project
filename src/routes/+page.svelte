<script lang="ts">
  import { untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { MediaItem } from "$lib/types/media";
  import { browseStore as browse } from "$lib/stores/browse.svelte";
  import { prefsStore as prefs } from "$lib/stores/prefs.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { continueItems } from "$lib/domain/libraryView";
  import { replannedText } from "$lib/domain/reminders";
  import { onReconnect } from "$lib/stores/online.svelte";
  import AppHeader from "$lib/components/ui/AppHeader.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import CategoryTabs from "$lib/components/ui/CategoryTabs.svelte";
  import NoKeyNote from "$lib/components/media/NoKeyNote.svelte";
  import { reminderStore } from "$lib/stores/reminders.svelte";
  import GenreCarousel from "$lib/components/ui/GenreCarousel.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import BackToTop from "$lib/components/ui/BackToTop.svelte";
  import MultiSelect from "$lib/components/ui/MultiSelect.svelte";
  import BrowseContext from "$lib/components/browse/BrowseContext.svelte";
  import ResultsGrid from "$lib/components/browse/ResultsGrid.svelte";
  import ContinueRow from "$lib/components/browse/ContinueRow.svelte";
  import { whenVisible } from "$lib/attachments/whenVisible";

  // Carousels start loading about one screen before they scroll into view.
  const PRELOAD_MARGIN = "100% 0px";

  const genreName = $derived(
    browse.activeGenre === null
      ? null
      : (browse.genres.find((g) => g.id === browse.activeGenre)?.name ?? "genre"),
  );

  const continuing = $derived(continueItems(libraryStore.entries, reminderStore.data.due));
  const replanned = $derived(
    reminderStore.data.replanned ? replannedText(reminderStore.data.replanned) : null,
  );

  let typed = $state(browse.query);

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

  // Wait for saved preferences; the browse store owns the user's current category.
  $effect(() => {
    if (!prefs.ready) return;
    untrack(() => {
      void browse.ensureLoaded();
    });
  });

  // Carousels or a grid that failed while offline load again once the network returns.
  onReconnect(() => browse.retryFailed());
</script>

<svelte:head><title>Aevum</title></svelte:head>

<div class="page">
  <AppHeader>
    {#snippet persistent()}
      {#snippet genreFilter()}
        <MultiSelect
          iconOnly
          label="Genres"
          options={browse.genreOptions}
          selected={browse.selectedGenres}
          onchange={(ids) => browse.setSelectedGenres(ids)}
        />
      {/snippet}
      <div class="search-slot">
        <SearchField
          mode="submit"
          trailing={browse.carouselMode && browse.genres.length > 0 ? genreFilter : undefined}
          label="Search the catalog"
          placeholder="Search movies, TV, anime, manga, books, games…"
          value={typed}
          loading={browse.loading && browse.isSearch}
          onchange={(v) => (typed = v)}
          onsubmit={(q) => browse.search(q)}
          onclear={clearSearch}
        />
      </div>
    {/snippet}
    {#snippet collapsible()}
      <CategoryTabs active={browse.activeCategory} onchange={(c) => browse.switchCategory(c)} />
    {/snippet}
  </AppHeader>

  <div class="page-body">
    <main class="main-col">
      {#if !browse.isSearch}
        <ContinueRow items={continuing} posterDir={libraryStore.posterDir} note={replanned} />
      {/if}

      <BrowseContext
        isSearch={browse.isSearch}
        query={browse.query}
        {genreName}
        onClearSearch={clearSearch}
        onAllGenres={() => browse.switchGenre(null)}
      />

      <NoKeyNote type={browse.activeCategory} />

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
          query={browse.isSearch ? browse.query : ""}
          type={browse.activeCategory}
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
  .search-slot {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  // ── Body: single column ─────────────────────────────────
  .page-body {
    display: flex;
    min-width: 0;
    // Air between the header and the first section, whichever section that is.
    padding-top: $spacing-lg;
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
  // Off-screen rails are not drawn (nor their shimmers run) until they come near.
  .carousel-slot {
    min-width: 0;
    content-visibility: auto;
    contain-intrinsic-size: auto 320px;
  }

  // ── States ──────────────────────────────────────────────
  .page-error {
    margin-bottom: $spacing-md;
  }
</style>
