<script lang="ts">
  // Badges (rating, year, runtime, counts, status, platforms), credits line and genres.
  import type { MediaDetail } from "$lib/types/media";
  import { formatRuntime } from "$lib/utils/format";

  let { detail } = $props<{ detail: MediaDetail }>();

  const year = $derived(detail.release_date?.slice(0, 4) ?? "");
  const rating = $derived(detail.vote_average > 0 ? detail.vote_average.toFixed(1) : "");
  const runtimeStr = $derived(formatRuntime(detail.runtime, detail.media_type));
</script>

<div class="meta-row">
  {#if rating}
    <span class="meta-badge meta-rating">★ {rating}</span>
  {/if}
  {#if year}
    <span class="meta-badge">{year}</span>
  {/if}
  {#if runtimeStr}
    <span class="meta-badge">{runtimeStr}</span>
  {/if}
  {#if detail.episodes}
    <span class="meta-badge">{detail.episodes} episodes</span>
  {/if}
  {#if detail.chapters}
    <span class="meta-badge">{detail.chapters} chapters</span>
  {/if}
  {#if detail.volumes}
    <span class="meta-badge">{detail.volumes} volumes</span>
  {/if}
  {#if detail.status}
    <span class="meta-badge">{detail.status}</span>
  {/if}
  {#if detail.platforms && detail.platforms.length > 0}
    {#each detail.platforms as p (p)}
      <span class="meta-badge">{p}</span>
    {/each}
  {/if}
</div>

{#if detail.developer}
  <p class="detail-studios">
    {detail.developer}{#if detail.publisher && detail.publisher !== detail.developer}
      · {detail.publisher}{/if}
  </p>
{:else if detail.studios && detail.studios.length > 0}
  <p class="detail-studios">{detail.studios.join(", ")}</p>
{/if}
{#if detail.author}
  <p class="detail-author">{detail.author}</p>
{/if}

{#if detail.genres.length > 0}
  <div class="genre-row">
    {#each detail.genres as genre (genre.id)}
      <span class="genre-pill">{genre.name}</span>
    {/each}
  </div>
{/if}

<style lang="scss">
  .meta-row {
    display: flex;
    gap: $spacing-sm;
    flex-wrap: wrap;
    margin-bottom: $spacing-md;
  }

  .detail-studios,
  .detail-author {
    font-size: 0.82rem;
    color: var(--clr-text-2);
    font-style: italic;
    margin-bottom: $spacing-md;
  }

  .meta-badge {
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.08);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-full;
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .meta-rating {
    color: var(--clr-primary);
    border-color: rgb(var(--clr-primary-rgb) / 0.25);
  }

  .genre-row {
    display: flex;
    gap: $spacing-xs;
    flex-wrap: wrap;
    margin-bottom: $spacing-lg;
  }

  .genre-pill {
    background: rgb(var(--clr-primary-rgb) / 0.1);
    border: 1px solid rgb(var(--clr-primary-rgb) / 0.2);
    color: var(--clr-primary);
    padding: 2px $spacing-sm;
    border-radius: $radius-full;
    font-size: 0.72rem;
    font-family: $font-mono;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
