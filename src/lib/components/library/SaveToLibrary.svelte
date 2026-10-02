<script lang="ts">
  import AddSheet from "./AddSheet.svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import { lengthFromDetail } from "$lib/domain/length";
  import { isBinary } from "$lib/domain/progress";
  import { libraryStore, LibraryStore, STATUSES, STATUS_LABELS } from "$lib/stores/library.svelte";
  import type { Length, LibraryStatus } from "$lib/types/library";
  import type { MediaDetail, MediaItem } from "$lib/types/media";

  let {
    item,
    detail = null,
    store = libraryStore,
    editing = $bindable(false),
  }: {
    item: MediaItem;
    detail?: MediaDetail | null;
    store?: LibraryStore;
    editing?: boolean;
  } = $props();

  const entry = $derived(store.get(item.media_key));
  const busy = $derived(store.isPending(item.media_key));
  const prefill = $derived(lengthFromDetail(item.media_type, detail));

  let adding = $state(false);
  const sheetOpen = $derived(adding || (editing && !!entry));
  const sheetLength = $derived(entry ? entry.user.length : prefill);
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

  const statusOptions = STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }));

  // A movie has no progress of its own; Completed is what marks it watched.
  function pickStatus(status: LibraryStatus) {
    if (!isBinary(item.media_type)) return store.update(item.media_key, { status });
    store.update(item.media_key, { status, progress: status === "completed" ? 1 : 0 });
  }
</script>

<div class="save-row">
  {#if entry}
    <span class="status-label" aria-hidden="true">Status</span>
    <div class="status-control" aria-busy={busy}>
      <SegmentedControl
        label="Status"
        options={statusOptions}
        value={entry.user.status}
        disabled={busy}
        onchange={pickStatus}
      />
    </div>
    <button
      type="button"
      class="remove-btn"
      disabled={busy}
      onclick={() => store.remove(item.media_key)}
    >
      Remove
    </button>
  {:else}
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
  {/if}
</div>

{#if sheetOpen}
  <Sheet label="Add to library" onclose={close}>
    <AddSheet
      mediaType={item.media_type}
      title={item.title}
      length={sheetLength}
      review={sheetReview}
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

  .status-label {
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .status-control {
    min-width: 0;
    max-width: 100%;
  }

  .remove-btn {
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text-2);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.78rem;
    cursor: pointer;

    @include touch {
      min-height: $touch-target;
    }

    &:hover:not(:disabled) {
      color: var(--clr-error);
      border-color: rgb(var(--clr-error-rgb) / 0.4);
    }
  }

  .save-error {
    color: var(--clr-error);
    font-size: 0.8rem;
    margin-bottom: $spacing-md;
  }
</style>
