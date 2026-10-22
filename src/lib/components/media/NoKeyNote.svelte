<script lang="ts">
  import { resolve } from "$app/paths";
  import { keysStore, KeysStore } from "$lib/stores/keys.svelte";
  import { manualEntry } from "$lib/stores/manualEntry.svelte";
  import { MEDIA_LABELS, type MediaType } from "$lib/types/media";

  // The store prop exists for tests; the app uses the singleton.
  let { type, store = keysStore }: { type: MediaType; store?: KeysStore } = $props();

  const PROVIDER: Partial<Record<MediaType, string>> = {
    movie: "TMDB",
    tv: "TMDB",
    game: "RAWG",
  };

  const missing = $derived(store.needsKey(type));
</script>

{#if missing}
  <div class="no-key">
    <p class="no-key-text">
      {MEDIA_LABELS[type]} needs a free {PROVIDER[type]} key to search the catalog. Add one in
      <a href={resolve("/settings")}>Settings</a>, or add what you are tracking yourself.
    </p>
    <button type="button" class="no-key-btn" onclick={() => manualEntry.open({ type })}>
      Add {MEDIA_LABELS[type].toLowerCase()} manually
    </button>
  </div>
{/if}

<style lang="scss">
  .no-key {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-sm;
    padding: $spacing-md;
    border-radius: $radius-md;
    background: var(--clr-surface-2);
    min-width: 0;
  }

  .no-key-text {
    font-size: 0.9rem;
    color: var(--clr-text-2);

    a {
      color: var(--clr-accent);
    }
  }

  .no-key-btn {
    display: inline-flex;
    align-items: center;
    padding: $spacing-xs $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
