<script lang="ts">
  import type { MediaItem, MediaType } from "$lib/types/media";
  import { getPosterUrl, getYear, getRating, MEDIA_LABELS } from "$lib/types/media";

  let { item, onclick } = $props<{
    item: MediaItem;
    onclick?: () => void;
  }>();

  let loaded = $state(false);
  let errored = $state(false);

  const poster = $derived(getPosterUrl(item));
  const year = $derived(getYear(item));
  const rating = $derived(getRating(item));
  const badge = $derived(MEDIA_LABELS[item.media_type as MediaType] ?? "Media");
</script>

<button class="card" {onclick} type="button">
  <div class="card__poster">
    {#if poster && !loaded && !errored}
      <div class="card__shimmer" aria-hidden="true"></div>
    {/if}

    {#if poster && !errored}
      <img
        src={poster}
        alt={item.title}
        loading="lazy"
        class="card__img"
        class:card__img--loaded={loaded}
        onload={() => (loaded = true)}
        onerror={() => (errored = true)}
      />
    {/if}

    {#if !poster || errored}
      <div class="card__no-poster" aria-hidden="true">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="m8 21 4-4 4 4" /><path d="M10 9l4 4" />
        </svg>
        <span>{item.title}</span>
      </div>
    {/if}

    <div class="card__overlay" aria-hidden="true">
      <div class="card__overlay-top">
        <span class="card__type">{badge}</span>
        {#if rating}
          <span class="card__score">★ {rating}</span>
        {/if}
      </div>

      <div class="card__overlay-body">
        <p class="card__overlay-title">{item.title}</p>
        {#if item.author}
          <p class="card__author">{item.author}</p>
        {/if}
        {#if item.overview}
          <p class="card__overview">{item.overview}</p>
        {/if}
        <div class="card__meta">
          {#if year}<span>{year}</span>{/if}
          {#if item.episodes}
            <span>·</span>
            <span>{item.episodes} eps</span>
          {/if}
          {#if item.chapters}
            <span>·</span>
            <span>{item.chapters} caps</span>
          {/if}
          {#if item.vote_count > 0}
            <span>·</span>
            <span>{item.vote_count.toLocaleString("en-US")} ratings</span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="card__label">
    <span class="card__label-title">{item.title}</span>
    {#if year}<span class="card__label-year">{year}</span>{/if}
  </div>
</button>

<style lang="scss">
  // ── Card shell ──────────────────────────────────────────
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    outline: none;

    &:focus-visible .card__poster {
      outline: 2px solid var(--clr-primary);
      outline-offset: 3px;
    }
  }

  // ── Poster ──────────────────────────────────────────────
  .card__poster {
    position: relative;
    aspect-ratio: 2 / 3;
    border-radius: $radius-md;
    overflow: hidden;
    background: var(--clr-surface);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.05);
    will-change: transform;
    transition:
      transform 350ms $ease-out-expo,
      box-shadow 350ms $ease-out-expo,
      border-color 220ms ease;

    @include hover-capable {
      .card:hover & {
        transform: translateY(-8px) scale(1.04);
        border-color: rgb(var(--clr-primary-rgb) / 0.4);
        box-shadow:
          0 24px 64px rgb(var(--clr-shade-rgb) / 0.75),
          0 0 0 1px rgb(var(--clr-primary-rgb) / 0.18),
          0 0 40px rgb(var(--clr-primary-rgb) / 0.1);
      }
    }

    .card:active & {
      transform: translateY(-3px) scale(1.01);
      transition-duration: 100ms;
    }
  }

  // ── Image ───────────────────────────────────────────────
  .card__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition:
      opacity 400ms ease,
      filter 350ms ease;

    &--loaded {
      opacity: 1;
    }

    @include hover-capable {
      .card:hover & {
        filter: brightness(0.38) saturate(1.15);
      }
    }
  }

  // ── Shimmer skeleton ────────────────────────────────────
  .card__shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      rgb(var(--clr-ink-rgb) / 0) 0%,
      rgb(var(--clr-ink-rgb) / 0.04) 40%,
      rgb(var(--clr-ink-rgb) / 0.08) 50%,
      rgb(var(--clr-ink-rgb) / 0.04) 60%,
      rgb(var(--clr-ink-rgb) / 0) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  // ── No-poster fallback ──────────────────────────────────
  .card__no-poster {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    padding: $spacing-md;
    background: linear-gradient(160deg, var(--clr-surface) 0%, var(--clr-bg) 100%);
    color: var(--clr-text-3);

    span {
      font-size: 0.7rem;
      text-align: center;
      line-height: 1.4;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
    }

    @include hover-capable {
      .card:hover & {
        filter: brightness(0.45);
      }
    }

    // The always-on touch overlay repeats the title; two copies collide mid-card.
    @include touch {
      span {
        display: none;
      }
    }
  }

  // ── Hover overlay ───────────────────────────────────────
  .card__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: $spacing-sm;
    opacity: 0;
    pointer-events: none;
    transition: opacity 300ms ease;
    // Gradient: transparent top → dark bottom
    background: linear-gradient(
      to bottom,
      rgb(var(--clr-shade-rgb) / 0.05) 0%,
      rgb(var(--clr-shade-rgb) / 0) 25%,
      rgb(var(--clr-shade-rgb) / 0) 40%,
      rgb(var(--clr-scrim-rgb) / 0.94) 100%
    );

    @include hover-capable {
      .card:hover & {
        opacity: 1;
      }
    }
    // Touch devices can't hover: show the info, and keep keyboard users covered too.
    @include touch {
      opacity: 1;
    }
    .card:focus-visible & {
      opacity: 1;
    }
  }

  .card__overlay-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-sm;
  }

  .card__overlay-body {
    display: flex;
    flex-direction: column;
    gap: 5px;

    // Always visible under touch, so it needs its own scrim over bright posters.
    @include touch {
      padding: $spacing-xs;
      border-radius: $radius-sm;
      background: rgb(var(--clr-scrim-rgb) / 0.72);
    }
  }

  // ── Type badge ──────────────────────────────────────────
  .card__type {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: var(--clr-primary);
    color: var(--clr-bg);
    padding: 2px 6px;
    border-radius: $radius-sm;
    line-height: 1.7;
    white-space: nowrap;
  }

  // ── Score pill ──────────────────────────────────────────
  .card__score {
    font-family: $font-mono;
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--clr-primary);
    background: rgb(var(--clr-primary-rgb) / 0.12);
    border: 1px solid rgb(var(--clr-primary-rgb) / 0.28);
    padding: 2px 7px;
    border-radius: $radius-sm;
    line-height: 1.7;
    white-space: nowrap;
  }

  // ── Overlay text ────────────────────────────────────────
  .card__overlay-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--clr-ink);
    line-height: 1.3;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card__overview {
    font-size: 0.68rem;
    color: rgb(var(--clr-ink-rgb) / 0.58);
    line-height: 1.55;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card__author {
    font-size: 0.68rem;
    color: rgb(var(--clr-ink-rgb) / 0.45);
    font-style: italic;
    margin: 0;
    @include truncate;
  }

  .card__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;

    span {
      font-family: $font-mono;
      font-size: 0.58rem;
      color: rgb(var(--clr-ink-rgb) / 0.35);
      letter-spacing: 0.03em;
    }
  }

  // ── Static label below poster ───────────────────────────
  .card__label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $spacing-xs;
    padding: 0 $spacing-xs;
  }

  .card__label-title {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--clr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    transition: color 200ms ease;

    @include hover-capable {
      .card:hover & {
        color: var(--clr-text);
      }
    }
  }

  .card__label-year {
    font-family: $font-mono;
    font-size: 0.64rem;
    color: var(--clr-text-3);
    flex-shrink: 0;
  }

  // ── Keyframes ───────────────────────────────────────────
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
