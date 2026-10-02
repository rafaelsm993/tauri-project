<script lang="ts">
  import { backupStore, BackupStore } from "$lib/stores/backup.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { formatDate, plural } from "$lib/utils/format";

  // The props exist for tests; the app uses the singletons.
  let {
    store = backupStore,
    libraryCount = libraryStore.entries.length,
  }: { store?: BackupStore; libraryCount?: number } = $props();

  let confirmingReplace = $state(false);

  function cancel() {
    confirmingReplace = false;
    void store.cancel();
  }

  function apply(mode: "merge" | "replace") {
    confirmingReplace = false;
    void store.apply(mode);
  }
</script>

<section class="backup" aria-labelledby="backup-title">
  <div class="backup-text">
    <h2 id="backup-title" class="backup-label">Backup</h2>
    <p class="backup-hint">
      Save your library, activity, posters and settings to one zip file, or bring one back. API keys
      are never included.
    </p>
  </div>

  <div class="backup-actions">
    <button type="button" class="btn" disabled={store.busy} onclick={() => store.exportNow()}>
      Export backup
    </button>
    <button type="button" class="btn" disabled={store.busy} onclick={() => store.pickImport()}>
      Import backup
    </button>
  </div>

  {#if store.preview}
    <div class="preview" role="group" aria-labelledby="preview-title">
      <h3 id="preview-title" class="preview-title">Backup to import</h3>
      <dl class="preview-facts">
        <dt>Created</dt>
        <dd>{formatDate(store.preview.created_at)}</dd>
        <dt>App version</dt>
        <dd>{store.preview.app_version}</dd>
        <dt>Contents</dt>
        <dd>
          {plural(store.preview.entries, "item")} · {plural(
            store.preview.events,
            "activity record",
          )} · {plural(store.preview.posters, "poster")}
        </dd>
      </dl>

      {#if confirmingReplace}
        <p class="preview-warning">
          Your {plural(libraryCount, "item")} become the backup's {plural(
            store.preview.entries,
            "item",
          )}. Anything not in the backup is removed, and your settings are restored from it. A copy
          of the current data is saved first.
        </p>
        <div class="backup-actions">
          <button
            type="button"
            class="btn btn-danger"
            disabled={store.busy}
            onclick={() => apply("replace")}
          >
            Replace library
          </button>
          <button
            type="button"
            class="btn"
            disabled={store.busy}
            onclick={() => (confirmingReplace = false)}
          >
            Back
          </button>
        </div>
      {:else}
        <p class="preview-hint">
          Merge keeps everything you have and takes the newer version of each item. Replace makes
          your library exactly the backup.
        </p>
        <div class="backup-actions">
          <button
            type="button"
            class="btn btn-primary"
            disabled={store.busy}
            onclick={() => apply("merge")}
          >
            Merge
          </button>
          <button
            type="button"
            class="btn"
            disabled={store.busy}
            onclick={() => (confirmingReplace = true)}
          >
            Replace
          </button>
          <button type="button" class="btn" disabled={store.busy} onclick={cancel}>Cancel</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if store.message}
    <p class="backup-message" role="status">{store.message}</p>
  {/if}
  {#if store.error}
    <ErrorNote message={store.error} />
  {/if}
</section>

<style lang="scss">
  .backup {
    max-width: 48rem;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-md;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
    background: var(--clr-surface);
    min-width: 0;
  }

  .backup-text {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }

  .backup-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .backup-hint,
  .preview-hint {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .backup-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-xs $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;

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
    }
  }

  .btn-primary {
    background: var(--clr-primary);
    border-color: transparent;
    color: var(--clr-on-primary);
  }

  .btn-danger {
    background: var(--clr-error);
    border-color: transparent;
    color: var(--clr-text-inv);
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    padding: $spacing-md;
    border-radius: $radius-md;
    background: var(--clr-surface-2);
    min-width: 0;
  }

  .preview-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .preview-facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: $spacing-xs $spacing-md;
    font-size: 0.85rem;

    dt {
      color: var(--clr-text-3);
    }

    dd {
      color: var(--clr-text);
      min-width: 0;
    }
  }

  .preview-warning {
    font-size: 0.85rem;
    color: var(--clr-error);
  }

  .backup-message {
    font-size: 0.85rem;
    overflow-wrap: anywhere;
    color: var(--clr-teal);
  }
</style>
