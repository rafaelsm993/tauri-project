<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { catalog } from "$lib/api/catalog";
  import { toMediaItem, type MediaDetail, type MediaType } from "$lib/types/media";
  import type { LibraryEntry } from "$lib/types/library";
  import { detailSource, entryForRoute, snapshotItem } from "$lib/domain/detailView";
  import { posterSources } from "$lib/domain/poster";
  import { posterKey as toPosterKey } from "$lib/utils/transition";
  import { onReconnect } from "$lib/stores/online.svelte";
  import { emptyLength, isPlannable, resolveTotal } from "$lib/domain/length";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { errorMessage } from "$lib/utils/errors";
  import { latest } from "$lib/utils/latest";
  import { goBack } from "$lib/utils/history";
  import DetailSkeleton from "$lib/components/detail/DetailSkeleton.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import Overview from "$lib/components/detail/Overview.svelte";
  import DetailHero from "$lib/components/detail/DetailHero.svelte";
  import DetailMeta from "$lib/components/detail/DetailMeta.svelte";
  import DetailSection from "$lib/components/detail/DetailSection.svelte";
  import TrailerEmbed from "$lib/components/detail/TrailerEmbed.svelte";
  import ScreenshotStrip from "$lib/components/detail/ScreenshotStrip.svelte";
  import CastRow from "$lib/components/detail/CastRow.svelte";
  import SaveToLibrary from "$lib/components/library/SaveToLibrary.svelte";
  import ProgressEditor from "$lib/components/library/ProgressEditor.svelte";
  import PlanDialog from "$lib/components/planner/PlanDialog.svelte";
  import { localDay } from "$lib/domain/calendar";

  let detail = $state<MediaDetail | null>(null);
  let planning = $state(false);
  let loading = $state(true);
  let error = $state("");
  let editingLength = $state(false);

  const trailer = $derived(
    detail?.videos.find((v) => v.type === "Trailer") ?? detail?.videos[0] ?? null,
  );

  const routeEntry = $derived(
    entryForRoute(libraryStore.entries, page.params.type ?? "", page.params.id ?? ""),
  );
  const savedEntry = $derived(detail ? libraryStore.get(detail.media_key) : routeEntry);
  const source = $derived(detailSource({ loading, detail, error, entry: routeEntry }));
  const mediaType = $derived<MediaType>(
    detail?.media_type ?? savedEntry?.snapshot.media_type ?? "movie",
  );
  const savedLength = $derived(savedEntry?.user.length ?? emptyLength());
  const savedTotal = $derived(resolveTotal(mediaType, detail, savedLength));
  const savedPlannable = $derived(isPlannable(mediaType, savedLength));
  const title = $derived(detail?.title ?? routeEntry?.snapshot.title ?? "");
  const posterKey = $derived(toPosterKey(page.params.type ?? "", page.params.id ?? ""));

  const begin = latest();

  // Only the newest request may fill the page; one for a page already left is dropped.
  async function fetchDetail(type: string, id: string) {
    const isCurrent = begin();
    loading = true;
    error = "";
    detail = null;
    try {
      const found = await catalog.fetchDetail(type, id);
      if (isCurrent()) detail = found;
    } catch (e) {
      if (isCurrent()) error = errorMessage(e, "Failed to load details.");
    } finally {
      if (isCurrent()) loading = false;
    }
  }

  const back = () => goBack(() => goto(resolve("/")));
  const retry = () => fetchDetail(page.params.type ?? "", page.params.id ?? "");

  onReconnect(() => {
    if (!detail) retry();
  });

  // IPC side effect on route param change.
  $effect(() => {
    const params = page.params;
    fetchDetail(params.type ?? "", params.id ?? "");
  });
</script>

<svelte:head><title>{title ? `${title} · Aevum` : "Aevum"}</title></svelte:head>

{#snippet controls(entry: LibraryEntry)}
  <ProgressEditor
    {mediaType}
    progress={entry.user.progress}
    total={savedTotal}
    plannable={savedPlannable}
    rating={entry.user.rating}
    disabled={libraryStore.isPending(entry.key)}
    onprogress={(progress) => libraryStore.update(entry.key, { progress })}
    onrating={(rating) => libraryStore.update(entry.key, { rating })}
    onaddlength={() => (editingLength = true)}
  />
  {#if entry.user.status !== "dropped"}
    {#if planning}
      <PlanDialog {entry} today={localDay()} onclose={() => (planning = false)} />
    {:else}
      <button type="button" class="plan-btn" onclick={() => (planning = true)}>
        {entry.user.plan ? "Edit plan" : "Plan"}
      </button>
    {/if}
  {/if}
{/snippet}

{#if source.kind === "loading"}
  <DetailSkeleton />
{:else if source.kind === "error"}
  <div class="detail-error">
    <ErrorNote message={source.message} onretry={retry}>
      <button type="button" onclick={back}><span aria-hidden="true">←</span> Back</button>
    </ErrorNote>
  </div>
{:else if source.kind === "detail"}
  {@const d = source.detail}
  <DetailHero
    title={d.title}
    tagline={d.tagline}
    backdropUrl={d.backdrop_path ?? null}
    posterUrl={d.poster_path ?? null}
    {posterKey}
    onBack={back}
  />

  <div class="detail-body">
    <div class="detail-info">
      <DetailMeta detail={d} />

      {#if d.overview}
        <Overview text={d.overview} />
      {/if}

      {#if trailer}
        <DetailSection title="Trailer">
          <TrailerEmbed videoKey={trailer.key} name={trailer.name} />
        </DetailSection>
      {/if}

      {#if d.screenshots && d.screenshots.length > 0}
        <DetailSection title="Screenshots">
          <ScreenshotStrip screenshots={d.screenshots} />
        </DetailSection>
      {/if}

      {#if d.cast.length > 0}
        <DetailSection title="Cast">
          <CastRow cast={d.cast} />
        </DetailSection>
      {/if}
    </div>

    <div class="detail-actions">
      <div class="detail-status">
        <SaveToLibrary item={toMediaItem(d)} detail={d} bind:editing={editingLength} />
      </div>
      {#if savedEntry}
        <div class="detail-controls">{@render controls(savedEntry)}</div>
      {/if}
    </div>
  </div>
{:else}
  {@const entry = source.entry}
  <DetailHero
    title={entry.snapshot.title}
    tagline=""
    backdropUrl={null}
    posterUrl={posterSources(entry.snapshot, libraryStore.posterDir)[0] ?? null}
    {posterKey}
    onBack={back}
  />

  <div class="detail-body">
    <div class="detail-info">
      <p class="saved-note" role="note">
        Showing your saved copy. Details load when you're online.
      </p>
    </div>

    <div class="detail-actions">
      <div class="detail-status">
        <SaveToLibrary item={snapshotItem(entry.snapshot)} bind:editing={editingLength} />
      </div>
      <div class="detail-controls">{@render controls(entry)}</div>
    </div>
  </div>
{/if}

<style lang="scss">
  // ── Detail body: content, then the actions column (a sticky bar on phone) ──
  .detail-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: $spacing-xl;
    max-width: 1440px;
    margin-inline: auto;
    padding: $spacing-2xl $spacing-xl $spacing-2xl;
    position: relative;
    z-index: 1;

    @include respond-to(md) {
      grid-template-columns: minmax(0, 1fr);
      gap: $spacing-md;
      padding: $spacing-md $spacing-md calc(#{$touch-target} + #{$spacing-xl});
    }
  }

  .detail-info {
    min-width: 0;
  }

  // Phone: the status row is a bar fixed above the tab bar; progress, rating and plan sit under the hero.
  .detail-actions {
    position: sticky;
    top: $spacing-lg;
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    min-width: 0;

    @include respond-to(md) {
      display: contents;
    }
  }

  .detail-controls {
    min-width: 0;

    @include respond-to(md) {
      order: -1;
    }
  }

  .detail-status {
    min-width: 0;

    :global(.segmented) {
      flex-wrap: wrap;
    }

    @include respond-to(md) {
      position: fixed;
      inset-inline: 0;
      bottom: calc(var(--nav-bottom) + env(safe-area-inset-bottom, 0px));
      z-index: var(--z-raised);
      padding: $spacing-sm $spacing-md;

      :global(.save-row) {
        flex-wrap: nowrap;
        margin-bottom: 0;
      }

      :global(.status-control) {
        flex: 1 1 0;
      }

      :global(.segmented) {
        flex-wrap: nowrap;
      }

      :global(.status-label) {
        display: none;
      }
      background: rgb(var(--clr-surface-rgb) / 0.94);
      backdrop-filter: blur(12px);
      border-top: 1px solid var(--clr-border);
    }
  }

  .saved-note {
    font-size: 0.85rem;
    color: var(--clr-text-2);
    margin: 0 0 $spacing-md;
  }

  .plan-btn {
    margin-bottom: $spacing-md;
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.8rem;
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
      padding-inline: $spacing-lg;
    }
  }

  // ── Error ───────────────────────────────────────────────
  .detail-error {
    max-width: 600px;
    margin: $spacing-2xl auto;
    padding-inline: $spacing-lg;
  }
</style>
