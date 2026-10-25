<script lang="ts">
  import AddSheet from "./AddSheet.svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import { fillMissing, lengthFromDetail } from "$lib/domain/length";
  import { libraryStore, LibraryStore } from "$lib/stores/library.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import type { Length } from "$lib/types/library";
  import type { MediaDetail, MediaItem } from "$lib/types/media";

  let {
    item,
    detail = null,
    store = libraryStore,
    prefs = prefsStore,
    editing = $bindable(false),
  }: {
    item: MediaItem;
    detail?: MediaDetail | null;
    store?: LibraryStore;
    prefs?: PrefsStore;
    editing?: boolean;
  } = $props();

  const entry = $derived(store.get(item.media_key));
  const busy = $derived(store.isPending(item.media_key));
  const prefill = $derived(lengthFromDetail(item.media_type, detail));

  let adding = $state(false);
  const sheetOpen = $derived(adding || (editing && !!entry));
  // A saved item keeps what was typed; the catalog fills only the gaps.
  const sheetLength = $derived(entry ? fillMissing(entry.user.length, prefill) : prefill);
  const sheetReview = $derived(entry ? entry.user.review : null);

  function close() {
    adding = false;
    editing = false;
  }

  function saveFromSheet(value: { length: Length; review: string | null }) {
    close();
    if (entry) store.update(item.media_key, value);
    else store.add(item, value);
  }
</script>

{#if !entry}
  <div class="save-row">
    <button
      type="button"
      class="add-btn"
      disabled={busy || sheetOpen}
      aria-busy={busy}
      aria-expanded={sheetOpen}
      onclick={() => (adding = true)}
    >
      + Add to library
    </button>
  </div>
{/if}

{#if sheetOpen}
  <Sheet label={entry ? `Edit ${item.title}` : "Add to library"} focus="sheet" onclose={close}>
    <AddSheet
      saved={!!entry}
      mediaType={item.media_type}
      title={item.title}
      length={sheetLength}
      review={sheetReview}
      chapterMinutes={prefs.prefs.manga_chapter_minutes}
      {busy}
      onsave={saveFromSheet}
      oncancel={close}
    />
  </Sheet>
{/if}

{#if store.error}
  <p class="save-error">⚠ {store.error}</p>
{/if}

<style lang="scss">
  .save-row {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-wrap: wrap;
    margin-bottom: $spacing-md;
  }

  .add-btn {
    background: var(--clr-primary);
    color: var(--clr-on-primary);
    border: none;
    padding: $spacing-sm $spacing-lg;
    border-radius: $radius-full;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.18s ease;

    &:hover:not(:disabled) {
      background: var(--clr-accent);
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }
  }

  .save-error {
    color: var(--clr-error);
    font-size: 0.8rem;
    margin-bottom: $spacing-md;
  }
</style>
