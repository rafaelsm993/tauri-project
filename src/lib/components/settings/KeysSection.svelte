<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { keysStore, KeysStore } from "$lib/stores/keys.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import type { Keyed } from "$lib/api/keys";

  // The prop exists for tests; the app uses the singleton.
  let { store = keysStore }: { store?: KeysStore } = $props();

  const PROVIDERS: { which: Keyed; label: string; serves: string; url: string }[] = [
    {
      which: "tmdb",
      label: "TMDB key",
      serves: "Movies and TV shows",
      url: "https://www.themoviedb.org/settings/api",
    },
    {
      which: "rawg",
      label: "RAWG key",
      serves: "Games",
      url: "https://rawg.io/apidocs",
    },
  ];

  let drafts = $state<Record<string, string>>({ tmdb: "", rawg: "" });

  async function save(which: Keyed) {
    if (await store.save(which, drafts[which])) drafts = { ...drafts, [which]: "" };
  }
</script>

<section class="keys" aria-labelledby="keys-title">
  <div class="keys-text">
    <h2 id="keys-title" class="keys-label">API keys</h2>
    <p class="keys-hint">
      Movies, TV and games need a free key from their provider. Books, anime and manga work without
      one. Keys stay on this device and are never included in a backup.
    </p>
  </div>

  {#each PROVIDERS as provider (provider.which)}
    <div class="key-row">
      <div class="key-head">
        <label class="key-name" for="key-{provider.which}">{provider.label}</label>
        <span class="key-serves">{provider.serves}</span>
        {#if store.presence[provider.which]}
          <span class="key-state">Saved</span>
        {/if}
      </div>

      <div class="key-controls">
        <input
          id="key-{provider.which}"
          type="password"
          class="key-input"
          autocomplete="off"
          spellcheck="false"
          placeholder={store.presence[provider.which] ? "Replace the saved key" : "Paste your key"}
          bind:value={drafts[provider.which]}
        />
        <button
          type="button"
          class="btn btn-primary"
          disabled={store.busy || drafts[provider.which].trim().length === 0}
          onclick={() => save(provider.which)}
        >
          Save {provider.which.toUpperCase()} key
        </button>
        {#if store.presence[provider.which]}
          <button
            type="button"
            class="btn"
            disabled={store.busy}
            onclick={() => store.forget(provider.which)}
          >
            Remove {provider.which.toUpperCase()} key
          </button>
        {/if}
      </div>

      <button type="button" class="key-link" onclick={() => openUrl(provider.url)}>
        How to get a {provider.which.toUpperCase()} key
      </button>

      {#if store.errorFor(provider.which)}
        <ErrorNote message={store.errorFor(provider.which)} />
      {/if}
    </div>
  {/each}
</section>

<style lang="scss">
  .keys {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-width: 0;
  }

  .keys-text {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .keys-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .keys-hint {
    font-size: 0.85rem;
    color: var(--clr-text-3);
  }

  .key-row {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    padding: $spacing-md;
    border-radius: $radius-md;
    background: var(--clr-surface-2);
    min-width: 0;
  }

  .key-head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: $spacing-xs $spacing-sm;
  }

  .key-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .key-serves {
    font-size: 0.8rem;
    color: var(--clr-text-3);
  }

  .key-state {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0 $spacing-xs;
    border-radius: $radius-full;
    background: rgb(var(--clr-teal-rgb) / 0.16);
    color: var(--clr-teal);
  }

  .key-controls {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
    min-width: 0;
  }

  .key-input {
    flex: 1 1 12rem;
    min-width: 0;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: var(--clr-surface);
    color: var(--clr-text);
    font-size: 0.85rem;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 1px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .key-link {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    font-size: 0.8rem;
    color: var(--clr-accent);
    text-decoration: underline;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }
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
      cursor: not-allowed;
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
</style>
