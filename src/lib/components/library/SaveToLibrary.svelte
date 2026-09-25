<script lang="ts">
  import AddSheet from "./AddSheet.svelte";
  import { lengthFromDetail } from "$lib/domain/length";
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

  const id = $props.id();
  const statusId = `${id}-status`;

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

  // Moves focus into the sheet when it opens.
  function focusFirst(node: HTMLElement) {
    node.querySelector<HTMLElement>("input, textarea, button")?.focus();
  }

  function pickStatus(event: Event) {
    const status = (event.currentTarget as HTMLSelectElement).value as LibraryStatus;
    store.update(item.media_key, { status });
  }
</script>

<div class="save-row">
  {#if entry}
    <label class="status-label" for={statusId}>Status</label>
    <select
      id={statusId}
      class="status-select"
      value={entry.user.status}
      disabled={busy}
      aria-busy={busy}
      onchange={pickStatus}
    >
      {#each STATUSES as status (status)}
        <option value={status}>{STATUS_LABELS[status]}</option>
      {/each}
    </select>
    <button class="remove-btn" disabled={busy} onclick={() => store.remove(item.media_key)}>
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
  <div
    class="sheet-wrap"
    role="dialog"
    aria-label="Add to library"
    tabindex="-1"
    {@attach focusFirst}
    onkeydown={(event) => event.key === "Escape" && close()}
  >
    <AddSheet
      mediaType={item.media_type}
      title={item.title}
      length={sheetLength}
      review={sheetReview}
      {busy}
      onsave={saveFromSheet}
      oncancel={close}
    />
  </div>
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
    color: var(--clr-text);
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

  .status-select {
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-primary-rgb) / 0.25);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-full;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .remove-btn {
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text-2);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.78rem;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--clr-error);
      border-color: rgb(var(--clr-error-rgb) / 0.4);
    }
  }

  .sheet-wrap {
    margin-bottom: $spacing-md;
  }

  .save-error {
    color: var(--clr-error);
    font-size: 0.8rem;
    margin-bottom: $spacing-md;
  }
</style>
