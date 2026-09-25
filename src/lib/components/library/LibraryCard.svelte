<script lang="ts">
  import { resolve } from "$app/paths";
  import { detailPath } from "$lib/domain/libraryView";
  import { resolveTotal } from "$lib/domain/length";
  import { isBinary, percent, progressLabel } from "$lib/domain/progress";
  import { STATUS_LABELS } from "$lib/stores/library.svelte";
  import { MEDIA_LABELS } from "$lib/types/media";
  import type { LibraryEntry } from "$lib/types/library";

  let { entry }: { entry: LibraryEntry } = $props();

  let errored = $state(false);

  const type = $derived(entry.snapshot.media_type);
  const total = $derived(resolveTotal(type, null, entry.user.length));
  const pct = $derived(isBinary(type) ? null : percent(entry.user.progress, total));
  const label = $derived(progressLabel(type, entry.user.progress, total));
  const path = $derived(detailPath(entry));
  const href = $derived(
    resolve("/media/[type]/[id]", { type: path.type, id: encodeURIComponent(path.id) }),
  );
</script>

<a class="lib-card" {href}>
  <div class="lib-card__poster">
    {#if entry.snapshot.poster_path && !errored}
      <img
        src={entry.snapshot.poster_path}
        alt=""
        loading="lazy"
        class="lib-card__img"
        onerror={() => (errored = true)}
      />
    {:else}
      <div class="lib-card__no-poster" aria-hidden="true">No poster</div>
    {/if}
    <span class="lib-card__type">{MEDIA_LABELS[type]}</span>
  </div>

  <div class="lib-card__body">
    <span class="lib-card__title">{entry.snapshot.title}</span>
    <span class="lib-card__status">{STATUS_LABELS[entry.user.status]}</span>
    {#if !isBinary(type)}
      <span class="lib-card__progress">{label}</span>
    {/if}
    {#if pct !== null}
      <div
        class="lib-card__bar"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={pct}
      >
        <div class="lib-card__fill" style:width="{pct}%"></div>
      </div>
    {/if}
  </div>
</a>

<style lang="scss">
  .lib-card {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
    color: inherit;
    text-decoration: none;
    border-radius: $radius-md;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 3px;
    }
  }

  .lib-card__poster {
    position: relative;
    aspect-ratio: 2 / 3;
    border-radius: $radius-md;
    overflow: hidden;
    background: var(--clr-surface);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.05);
    transition: border-color $dur-fast ease;

    @include hover-capable {
      .lib-card:hover & {
        border-color: rgb(var(--clr-primary-rgb) / 0.4);
      }
    }
  }

  .lib-card__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lib-card__no-poster {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: 0.75rem;
    color: var(--clr-text-3);
  }

  .lib-card__type {
    position: absolute;
    top: $spacing-xs;
    left: $spacing-xs;
    padding: 2px $spacing-xs;
    border-radius: $radius-sm;
    background: rgb(var(--clr-surface-rgb) / 0.85);
    font-size: 0.68rem;
    color: var(--clr-text);
  }

  .lib-card__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .lib-card__title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--clr-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lib-card__status,
  .lib-card__progress {
    font-size: 0.75rem;
    color: var(--clr-text-2);
  }

  .lib-card__bar {
    height: 4px;
    border-radius: $radius-full;
    background: rgb(var(--clr-ink-rgb) / 0.12);
    overflow: hidden;
  }

  .lib-card__fill {
    height: 100%;
    background: var(--clr-primary);
  }
</style>
