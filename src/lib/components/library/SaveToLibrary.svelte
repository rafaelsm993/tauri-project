<script lang="ts">
  import { libraryStore, LibraryStore, STATUSES, STATUS_LABELS } from "$lib/stores/library.svelte";
  import type { LibraryStatus } from "$lib/types/library";
  import type { MediaItem } from "$lib/types/media";

  let { item, store = libraryStore } = $props<{ item: MediaItem; store?: LibraryStore }>();

  const id = $props.id();
  const statusId = `${id}-status`;

  const entry = $derived(store.get(item.media_key));
  const busy = $derived(store.isPending(item.media_key));

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
    <button class="add-btn" disabled={busy} aria-busy={busy} onclick={() => store.add(item)}>
      + Add to library
    </button>
  {/if}
</div>

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

  .save-error {
    color: var(--clr-error);
    font-size: 0.8rem;
    margin-bottom: $spacing-md;
  }
</style>
