<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { MediaItem } from "$lib/types/media";
  import { BrowseStore } from "$lib/stores/browse.svelte";
  import SearchBar from "$lib/components/ui/SearchBar.svelte";
  import CategoryTabs from "$lib/components/ui/CategoryTabs.svelte";
  import GenreCarousel from "$lib/components/ui/GenreCarousel.svelte";
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
</script>

<div class="page">
  <header class="page-header">
    <SearchBar
      onSearch={(q) => browse.search(q)}
      placeholder="Search movies, TV shows, anime, manga, books…"
    />

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
  </header>

  <div class="page-body">
    <main class="main-col">
      <BrowseContext
        isSearch={browse.isSearch}
        query={browse.query}
        {genreName}
        onClearSearch={() => browse.clearSearch()}
        onAllGenres={() => browse.switchGenre(null)}
      />

      {#if browse.error && !browse.carouselMode}
        <div class="page-error">
          <span>⚠ {browse.error}</span>
          <button onclick={() => browse.loadGrid(browse.query)}>Try again</button>
        </div>
      {/if}

      {#if browse.carouselMode}
        {#if browse.sections.length === 0 && !browse.genresLoading}
          <p class="page-empty">No genres available.</p>
        {:else}
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
        {/if}
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
    padding: $spacing-lg $spacing-xl $spacing-2xl;
    max-width: 1440px;
    margin-inline: auto;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    padding: $spacing-md $spacing-lg;
    background: rgb(var(--clr-error-rgb) / 0.07);
    border: 1px solid rgb(var(--clr-error-rgb) / 0.2);
    border-radius: $radius-md;
    color: var(--clr-error);
    font-size: 0.84rem;
    margin-bottom: $spacing-md;
    button {
      background: none;
      border: 1px solid rgb(var(--clr-error-rgb) / 0.3);
      color: var(--clr-error);
      padding: $spacing-xs $spacing-sm;
      border-radius: $radius-sm;
      font-size: 0.76rem;
      cursor: pointer;
      &:hover {
        background: rgb(var(--clr-error-rgb) / 0.1);
      }
    }
  }

  .page-empty {
    text-align: center;
    color: var(--clr-text-3);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    padding: $spacing-2xl 0;
  }
</style>
