<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onDestroy } from "svelte";
  import { catalog } from "$lib/api/catalog";
  import { toMediaItem, type MediaDetail } from "$lib/types/media";
  import { totalFor } from "$lib/domain/progress";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { ui } from "$lib/stores/ui.svelte";
  import { errorMessage } from "$lib/utils/errors";
  import DetailSkeleton from "$lib/components/detail/DetailSkeleton.svelte";
  import DetailHero from "$lib/components/detail/DetailHero.svelte";
  import DetailMeta from "$lib/components/detail/DetailMeta.svelte";
  import DetailSection from "$lib/components/detail/DetailSection.svelte";
  import TrailerEmbed from "$lib/components/detail/TrailerEmbed.svelte";
  import ScreenshotStrip from "$lib/components/detail/ScreenshotStrip.svelte";
  import CastRow from "$lib/components/detail/CastRow.svelte";
  import SaveToLibrary from "$lib/components/library/SaveToLibrary.svelte";
  import ProgressEditor from "$lib/components/library/ProgressEditor.svelte";

  let detail = $state<MediaDetail | null>(null);
  let loading = $state(true);
  let error = $state("");

  // Detail pages use the geometric background.
  ui.detailMode = true;
  onDestroy(() => {
    ui.detailMode = false;
  });

  const trailer = $derived(
    detail?.videos.find((v) => v.type === "Trailer") ?? detail?.videos[0] ?? null,
  );

  const savedEntry = $derived(detail ? libraryStore.get(detail.media_key) : undefined);
  const savedTotal = $derived(detail ? totalFor(detail.media_type, detail) : null);

  async function fetchDetail(type: string, id: string) {
    loading = true;
    error = "";
    detail = null;
    try {
      detail = await catalog.fetchDetail(type, id);
    } catch (e) {
      error = errorMessage(e, "Failed to load details.");
    } finally {
      loading = false;
    }
  }

  const goHome = () => goto(resolve("/"));
  const retry = () => fetchDetail($page.params.type ?? "", $page.params.id ?? "");

  // IPC side effect on route param change.
  $effect(() => {
    const params = $page.params;
    fetchDetail(params.type ?? "", params.id ?? "");
  });
</script>

{#if loading}
  <DetailSkeleton />
{:else if error}
  <div class="detail-error">
    <span>⚠ {error}</span>
    <button onclick={retry}>Try again</button>
    <button onclick={goHome}>← Back</button>
  </div>
{:else if detail}
  <DetailHero
    title={detail.title}
    tagline={detail.tagline}
    backdropUrl={detail.backdrop_path ?? null}
    onBack={goHome}
  />

  <div class="detail-body">
    <aside class="detail-poster">
      {#if detail.poster_path}
        <img src={detail.poster_path} alt={detail.title} class="poster-img" />
      {:else}
        <div class="poster-placeholder">No poster</div>
      {/if}
    </aside>

    <div class="detail-info">
      <DetailMeta {detail} />

      <SaveToLibrary item={toMediaItem(detail)} />

      {#if savedEntry}
        <ProgressEditor
          mediaType={detail.media_type}
          progress={savedEntry.user.progress}
          total={savedTotal}
          rating={savedEntry.user.rating}
          disabled={libraryStore.isPending(detail.media_key)}
          onprogress={(progress) => libraryStore.update(savedEntry.key, { progress })}
          onrating={(rating) => libraryStore.update(savedEntry.key, { rating })}
        />
      {/if}

      {#if detail.overview}
        <p class="overview">{detail.overview}</p>
      {/if}

      {#if trailer}
        <DetailSection title="Trailer">
          <TrailerEmbed videoKey={trailer.key} name={trailer.name} />
        </DetailSection>
      {/if}

      {#if detail.screenshots && detail.screenshots.length > 0}
        <DetailSection title="Screenshots">
          <ScreenshotStrip screenshots={detail.screenshots} />
        </DetailSection>
      {/if}

      {#if detail.cast.length > 0}
        <DetailSection title="Cast">
          <CastRow cast={detail.cast} />
        </DetailSection>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  // ── Detail body (2-col) ─────────────────────────────────
  .detail-body {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: $spacing-xl;
    max-width: 1440px;
    margin-inline: auto;
    padding: 0 $spacing-xl $spacing-2xl;
    position: relative;
    z-index: 1;
  }

  .detail-info {
    min-width: 0;
    padding-top: $spacing-md;
  }

  .poster-img {
    width: 100%;
    border-radius: $radius-lg;
    box-shadow: 0 8px 30px rgb(var(--clr-shade-rgb) / 0.5);
  }

  .poster-placeholder {
    width: 100%;
    aspect-ratio: 2/3;
    border-radius: $radius-lg;
    background: var(--clr-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--clr-text-3);
    font-size: 0.82rem;
  }

  // ── Overview ────────────────────────────────────────────
  .overview {
    font-size: 0.92rem;
    line-height: 1.7;
    color: var(--clr-text-2);
    margin-bottom: $spacing-xl;
  }

  // ── Error ───────────────────────────────────────────────
  .detail-error {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-lg $spacing-xl;
    max-width: 600px;
    margin: $spacing-2xl auto;
    background: rgb(var(--clr-error-rgb) / 0.07);
    border: 1px solid rgb(var(--clr-error-rgb) / 0.2);
    border-radius: $radius-md;
    color: var(--clr-error);
    font-size: 0.84rem;

    button {
      background: none;
      border: 1px solid rgb(var(--clr-error-rgb) / 0.3);
      color: var(--clr-error);
      padding: $spacing-xs $spacing-sm;
      border-radius: $radius-sm;
      font-size: 0.76rem;
      cursor: pointer;
      white-space: nowrap;
      &:hover {
        background: rgb(var(--clr-error-rgb) / 0.1);
      }
    }
  }

  // ── Responsive ──────────────────────────────────────────
  @include respond-to(md) {
    .detail-body {
      grid-template-columns: 1fr;
    }
    .detail-poster {
      display: none;
    }
    .detail-info {
      padding-top: 0;
    }
  }
</style>
