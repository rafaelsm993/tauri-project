<script lang="ts">
  import PosterPlaceholder from "$lib/components/media/PosterPlaceholder.svelte";
  import { mergeChanges } from "$lib/domain/reconcile";
  import { posterSources } from "$lib/domain/poster";
  import { getYear, MEDIA_LABELS, PROVIDER_LABELS, type MediaItem } from "$lib/types/media";
  import type { LibraryEntry } from "$lib/types/library";

  // Yours → the catalog's, then only what changes (old → new); what stays is one line.
  let {
    item,
    mine,
    merged,
    combined,
    posterDir,
  }: {
    item: MediaItem;
    mine: LibraryEntry;
    merged: LibraryEntry;
    combined: boolean;
    posterDir: string | null;
  } = $props();

  const id = $props.id();
  const diff = $derived(mergeChanges(mine, merged));
  const minePoster = $derived(posterSources(mine.snapshot, posterDir)[0] ?? null);
  const meta = $derived([MEDIA_LABELS[item.media_type], getYear(item)].filter(Boolean).join(" · "));
</script>

<div class="compare">
  <div class="sides">
    <figure class="side">
      <div class="poster">
        {#if minePoster}
          <img src={minePoster} alt="" />
        {:else}
          <PosterPlaceholder title={mine.snapshot.title} type={mine.snapshot.media_type} />
        {/if}
      </div>
      <figcaption>
        <span class="side-label">Yours</span>
        <span class="side-title">{mine.snapshot.title}</span>
      </figcaption>
    </figure>
    <span class="arrow" aria-hidden="true">→</span>
    <figure class="side">
      <div class="poster">
        {#if item.poster_path}
          <img src={item.poster_path} alt="" />
        {:else}
          <PosterPlaceholder title={item.title} type={item.media_type} />
        {/if}
      </div>
      <figcaption>
        <span class="side-label">{PROVIDER_LABELS[item.provider]}</span>
        <span class="side-title">{item.title}</span>
        <span class="side-meta">{meta}</span>
      </figcaption>
    </figure>
  </div>

  {#if diff.changed.length > 0}
    <h3 class="changes-title" id="{id}-changes">What changes</h3>
    <ul class="changes" aria-labelledby="{id}-changes">
      {#each diff.changed as row (row.label)}
        <li class="change">
          <span class="change-label">{row.label}</span>
          <span class="change-values">
            <s class="before">
              {#if row.before}<span class="sr">was&nbsp;</span>{row.before}{:else}<span class="sr"
                  >was empty</span
                ><span aria-hidden="true">—</span>{/if}
            </s>
            <span class="to" aria-hidden="true">→</span>
            <strong class="after">
              {#if row.after}<span class="sr">, now&nbsp;</span>{row.after}{:else}<span class="sr"
                  >, now empty</span
                ><span aria-hidden="true">—</span>{/if}
            </strong>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if diff.capped}
    <p class="cap">
      Your progress was past this length, so it stops at the end and the item is marked Completed.
    </p>
  {/if}
  {#if diff.kept.length > 0}
    <p class="kept">Kept as is: {diff.kept.join(", ")}</p>
  {/if}
</div>

{#if combined}
  <p class="combined" role="note">
    You already have this in your library. They'll be combined: catalog details win, with saved data
    filling any blanks. Status and progress keep the further value, capped at the new length;
    rating, review and plan come from whichever you changed last.
  </p>
{/if}

<style lang="scss">
  .compare {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-width: 0;
  }

  .sides {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: start;
    gap: $spacing-sm;
  }

  .side {
    margin: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .poster {
    width: min(5rem, 100%);
    aspect-ratio: 2 / 3;
    border-radius: $radius-sm;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .arrow {
    align-self: center;
    color: var(--clr-accent);
    font-size: 1.25rem;
  }

  // Small caps for the side and row labels: names for the values, not more headings.
  .side-label,
  .change-label {
    font-family: $font-mono;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--clr-text-2);
  }

  .side-title {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .side-meta {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .changes-title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .changes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }

  // Wide: label | values on one line. Narrow: label above the values.
  .change {
    display: grid;
    grid-template-columns: minmax(8rem, 1fr) minmax(0, 2fr);
    align-items: baseline;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;

    & + & {
      border-top: 1px solid var(--clr-border);
    }

    @include respond-to(md) {
      grid-template-columns: minmax(0, 1fr);
      gap: 2px;
    }
  }

  .change-values {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 $spacing-xs;
    min-width: 0;
  }

  // Old: struck and quiet. New: plain and strong. Words never break inside.
  .before {
    color: var(--clr-text-2);
    overflow-wrap: normal;
  }

  .after {
    color: var(--clr-text);
    font-weight: 600;
    overflow-wrap: normal;
  }

  .to {
    color: var(--clr-accent);
  }

  .sr {
    @include sr-only;
  }

  .cap,
  .kept {
    margin: 0;
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .combined {
    margin: $spacing-md 0 0;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-sm;
    background: rgb(var(--clr-accent-rgb) / 0.12);
    font-size: 0.9rem;
  }
</style>
