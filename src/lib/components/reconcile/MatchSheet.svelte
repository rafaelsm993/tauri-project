<script lang="ts">
  import { untrack } from "svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import Toast from "$lib/components/ui/Toast.svelte";
  import MediaCard from "$lib/components/media/MediaCard.svelte";
  import MatchCompare from "./MatchCompare.svelte";
  import { catalog as catalogApi, type Catalog } from "$lib/api/catalog";
  import { libraryStore, LibraryStore, type PreviewResult } from "$lib/stores/library.svelte";
  import { match as matchStore, MatchStore } from "$lib/stores/match.svelte";
  import { motionStore } from "$lib/stores/motion.svelte";
  import { lengthFromDetail } from "$lib/domain/length";
  import { errorMessage } from "$lib/utils/errors";
  import { latest } from "$lib/utils/latest";
  import type { Length } from "$lib/types/library";
  import type { MediaDetail, MediaItem } from "$lib/types/media";

  const MAX_RESULTS = 8;

  // The app's one "Find a match" sheet, mounted by the root layout; the props exist for tests.
  let {
    match = matchStore,
    library = libraryStore,
    catalog = catalogApi,
  }: { match?: MatchStore; library?: LibraryStore; catalog?: Catalog } = $props();

  let query = $state("");
  let results = $state<MediaItem[]>([]);
  let searching = $state(false);
  let searchError = $state("");
  let searched = $state(false);
  let picked = $state<{
    item: MediaItem;
    detail: MediaDetail | null;
    length: Length;
    result: PreviewResult;
  } | null>(null);
  let picking = $state(false);
  let saving = $state(false);
  let saveError = $state("");

  const mine = $derived(match.current);
  const beginSearch = latest();
  const beginPick = latest();

  async function search(text: string) {
    if (!mine) return;
    const isCurrent = beginSearch();
    searching = true;
    searchError = "";
    try {
      const page = await catalog.fetchPage(mine.snapshot.media_type, text, 1, null);
      if (isCurrent()) results = page.results.slice(0, MAX_RESULTS);
    } catch (e) {
      if (isCurrent()) searchError = errorMessage(e, "The search failed.");
    } finally {
      if (isCurrent()) {
        searching = false;
        searched = true;
      }
    }
  }

  // The catalog length decides whether the user's progress still fits (Q4), so ask for it first.
  async function pick(item: MediaItem) {
    if (!mine) return;
    const isCurrent = beginPick();
    picking = true;
    saveError = "";
    const detail = await catalog.fetchDetail(item.media_type, String(item.id)).catch(() => null);
    const length = lengthFromDetail(item.media_type, detail);
    const result = await library.preview(mine.key, item, length, detail);
    if (!isCurrent()) return;
    picking = false;
    picked = { item, detail, length, result };
  }

  function backToResults() {
    beginPick();
    picking = false;
    picked = null;
    saveError = "";
  }

  async function use() {
    if (!mine || !picked) return;
    saving = true;
    saveError = "";
    const saved = await library.merge(mine.key, picked.item, picked.length, picked.detail);
    saving = false;
    if (saved) match.merged(saved);
    else saveError = library.error || "Couldn't use this match.";
  }

  function reset() {
    beginSearch();
    beginPick();
    results = [];
    searched = false;
    searching = false;
    searchError = "";
    picked = null;
    picking = false;
    saving = false;
    saveError = "";
  }

  // IPC side effect: a newly opened sheet searches for the item's own title.
  $effect(() => {
    const opened = mine;
    untrack(() => {
      reset();
      if (!opened) return;
      query = opened.snapshot.title;
      search(query);
    });
  });
</script>

{#if mine}
  <Sheet
    label={`Find a match for ${mine.snapshot.title}`}
    size="full"
    onclose={() => match.close()}
    onclosed={() => match.closed()}
  >
    <div class="match">
      <div class="match-head">
        <h2 class="match-title">Find a match</h2>
        <button type="button" class="close" aria-label="Close" onclick={() => match.close()}>
          ✕
        </button>
      </div>

      {#if picked}
        <MatchCompare
          item={picked.item}
          {mine}
          merged={picked.result.ok ? picked.result.preview.entry : mine}
          posterDir={library.posterDir}
          combined={picked.result.ok && picked.result.preview.combined}
        />
        {#if !picked.result.ok}
          <ErrorNote message={picked.result.reason} />
        {:else if saveError}
          <ErrorNote message={saveError} />
        {/if}
        <div class="match-actions">
          {#if picked.result.ok}
            <button
              type="button"
              class="btn primary"
              disabled={saving}
              aria-busy={saving}
              onclick={use}
            >
              Use this
            </button>
          {/if}
          <button type="button" class="btn ghost" disabled={saving} onclick={backToResults}>
            Back to results
          </button>
        </div>
      {:else}
        <p class="hint">
          Pick the catalog item this is. Its title, year and poster replace yours; your status,
          progress, rating, review and plan stay.
        </p>
        <SearchField
          label="Search the catalog"
          mode="submit"
          value={query}
          loading={searching || picking}
          onchange={(v) => (query = v)}
          onsubmit={search}
        />
        {#if searchError}
          <ErrorNote
            message={searchError}
            onretry={() => search(query.trim() || mine.snapshot.title)}
          />
        {:else if searched && !searching && results.length === 0}
          <p class="empty">No match found</p>
        {:else if results.length > 0}
          <ul class="results" aria-label="Catalog results" aria-busy={picking}>
            {#each results as item (item.media_key)}
              <li><MediaCard {item} store={library} onclick={() => pick(item)} /></li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>
  </Sheet>
{/if}

<Toast
  open={!!match.notice || !!match.error}
  label="Matched"
  onclose={() => match.dismiss()}
  autoHideMs={10000}
  resetKey={match.notice?.into.key ?? match.error}
  motion={motionStore.on}
  closeLabel="Dismiss"
>
  <p class="notice">
    {#if match.notice}
      Matched to {match.notice.into.snapshot.title}
    {:else}
      ⚠ {match.error}
    {/if}
  </p>
  {#snippet actions()}
    {#if match.notice}
      <button type="button" class="notice-undo" onclick={() => match.undo(library)}>Undo</button>
    {/if}
  {/snippet}
</Toast>

<style lang="scss">
  .match {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-height: 100%;
    padding: $spacing-lg;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }

  .match-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
  }

  .match-title {
    min-width: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .close {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: $radius-full;
    background: rgb(var(--clr-ink-rgb) / 0.08);
    color: var(--clr-text);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover {
        background: rgb(var(--clr-ink-rgb) / 0.16);
      }
    }

    @include touch {
      width: $touch-target;
      height: $touch-target;
    }
  }

  .hint,
  .empty {
    margin: 0;
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(9rem, 40%), 1fr));
    gap: $spacing-md;
    margin: 0;
    padding: 0;
    list-style: none;

    &[aria-busy="true"] {
      opacity: 0.6;
      pointer-events: none;
    }

    // The card sizes to its container, so the item must give it a width.
    > li {
      display: flex;
      min-width: 0;

      > :global(.card) {
        width: 100%;
      }
    }
  }

  .match-actions {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    margin-top: auto;
    padding-block: $spacing-sm;
    background: var(--clr-surface);
  }

  .btn {
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.85rem;
    cursor: pointer;

    &.primary {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-on-primary);
      font-weight: 600;
    }

    &.ghost {
      color: var(--clr-text-2);
      border-color: transparent;
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
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
      padding-inline: $spacing-lg;
    }
  }

  .notice {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 0.9rem;
  }

  .notice-undo {
    min-height: 36px;
    padding: 0 $spacing-md;
    border: none;
    border-radius: $radius-sm;
    background: var(--clr-primary);
    color: var(--clr-on-primary);
    font-weight: 600;
    cursor: pointer;

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
