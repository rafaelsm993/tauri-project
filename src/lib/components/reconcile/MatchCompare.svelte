<script lang="ts">
  import PosterPlaceholder from "$lib/components/media/PosterPlaceholder.svelte";
  import { STATUS_LABELS } from "$lib/stores/library.svelte";
  import { progressLabel } from "$lib/domain/progress";
  import { resolveTotal } from "$lib/domain/length";
  import { getYear, MEDIA_LABELS, type MediaItem } from "$lib/types/media";
  import type { LibraryEntry } from "$lib/types/library";

  // "Catalog" (what replaces the title, year and poster) beside what the user keeps.
  let { item, kept, combined }: { item: MediaItem; kept: LibraryEntry; combined: boolean } =
    $props();

  const user = $derived(kept.user);
  const year = $derived(getYear(item));
  const progress = $derived(
    progressLabel(item.media_type, user.progress, resolveTotal(item.media_type, null, user.length)),
  );
</script>

<div class="compare">
  <section class="side" aria-labelledby="match-catalog">
    <h3 id="match-catalog">Catalog</h3>
    <div class="poster">
      {#if item.poster_path}
        <img src={item.poster_path} alt="" />
      {:else}
        <PosterPlaceholder title={item.title} type={item.media_type} />
      {/if}
    </div>
    <p class="title">{item.title}</p>
    <p class="muted">{[MEDIA_LABELS[item.media_type], year].filter(Boolean).join(" · ")}</p>
  </section>

  <section class="side" aria-labelledby="match-kept">
    <h3 id="match-kept">Yours, kept</h3>
    <dl>
      <dt>Status</dt>
      <dd>{STATUS_LABELS[user.status]}</dd>
      <dt>Progress</dt>
      <dd>{progress}</dd>
      {#if user.rating !== null}
        <dt>Rating</dt>
        <dd>{user.rating}/10</dd>
      {/if}
      {#if user.plan}
        <dt>Plan</dt>
        <dd>Kept</dd>
      {/if}
      {#if user.review}
        <dt>Review</dt>
        <dd>Kept</dd>
      {/if}
    </dl>
  </section>
</div>

{#if combined}
  <p class="combined" role="note">
    You already have this in your library. They'll be combined: the further status and progress win,
    and the rest comes from whichever you changed last.
  </p>
{/if}

<style lang="scss">
  .compare {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-md;
  }

  .side {
    min-width: 0;
    padding: $spacing-md;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;

    h3 {
      margin: 0 0 $spacing-sm;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--clr-text-2);
    }
  }

  .poster {
    width: min(7rem, 100%);
    aspect-ratio: 2 / 3;
    margin-bottom: $spacing-sm;
    border-radius: $radius-sm;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .title {
    margin: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .muted {
    margin: $spacing-xs 0 0;
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  // Label above value: side by side, a 360 px column broke "In progress" mid-word.
  dl {
    display: flex;
    flex-direction: column;
    margin: 0;
    font-size: 0.9rem;
  }

  dt {
    color: var(--clr-text-2);
    font-size: 0.8rem;

    &:not(:first-child) {
      margin-top: $spacing-sm;
    }
  }

  dd {
    margin: 0;
    overflow-wrap: break-word;
  }

  .combined {
    margin: $spacing-md 0 0;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-sm;
    background: rgb(var(--clr-accent-rgb) / 0.12);
    font-size: 0.9rem;
  }
</style>
