<script lang="ts">
  import { manualEntry, ManualEntryStore, type After } from "$lib/stores/manualEntry.svelte";
  import type { MediaKey, MediaType } from "$lib/types/media";

  // One line anywhere in the app opens the shared add/edit sheet; `entry` exists for tests.
  let {
    type,
    title,
    edit = null,
    after,
    variant = "button",
    label = "Add manually",
    entry = manualEntry,
  }: {
    type?: MediaType;
    title?: string;
    edit?: MediaKey | null;
    after?: After;
    variant?: "button" | "link" | "icon";
    label?: string;
    entry?: ManualEntryStore;
  } = $props();
</script>

<button
  type="button"
  class="add-manually {variant}"
  aria-label={variant === "icon" ? label : undefined}
  aria-haspopup="dialog"
  aria-expanded={entry.current !== null}
  onclick={() => entry.open({ type, title, edit, after })}
>
  {#if variant === "icon"}
    <span aria-hidden="true">+</span>
  {:else}
    {label}
  {/if}
</button>

<style lang="scss">
  .add-manually {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-xs;
    flex-shrink: 0;
    font: inherit;
    cursor: pointer;

    @include touch {
      min-height: $touch-target;
      min-width: $touch-target;
    }
  }

  .button {
    padding: $spacing-xs $spacing-md;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font-size: 0.85rem;

    @include hover-capable {
      &:hover {
        border-color: var(--clr-accent);
      }
    }
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--clr-accent);
    font-size: 0.9rem;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .icon {
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font-size: 1.25rem;
    line-height: 1;

    @include hover-capable {
      &:hover {
        border-color: var(--clr-accent);
      }
    }
  }

  .add-manually:focus-visible {
    outline: 2px solid var(--clr-accent);
    outline-offset: 2px;
  }
</style>
