<script lang="ts">
  // Backdrop image with the poster, title, tagline and the back button.
  let {
    title,
    tagline,
    backdropUrl,
    posterUrl = null,
    onBack,
  }: {
    title: string;
    tagline: string;
    backdropUrl: string | null;
    posterUrl?: string | null;
    onBack: () => void;
  } = $props();
</script>

<div class="hero">
  {#if backdropUrl}
    <img src={backdropUrl} alt="" class="hero-img" />
  {/if}
  <div class="hero-fade"></div>
  <div class="hero-content">
    <button type="button" class="back-btn" onclick={onBack}>
      <span aria-hidden="true">←</span> Back
    </button>
    <div class="hero-row">
      {#if posterUrl}
        <img class="hero-poster" src={posterUrl} alt="" />
      {/if}
      <div class="hero-text">
        <h1 class="hero-title">{title}</h1>
        {#if tagline}
          <p class="hero-tagline">{tagline}</p>
        {/if}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .hero {
    position: relative;
    z-index: 2;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: clamp(260px, 42vw, 420px);
  }

  .hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      var(--clr-bg) 0%,
      transparent 50%,
      rgb(var(--clr-bg-rgb) / 0.4) 100%
    );
  }

  .hero-content {
    position: relative;
    width: 100%;
    padding: $spacing-xl $spacing-xl $spacing-lg;
    max-width: 1440px;
    margin-inline: auto;
  }

  .back-btn {
    background: rgb(var(--clr-surface-rgb) / 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.1);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.82rem;
    cursor: pointer;
    margin-bottom: $spacing-md;
    transition: background $dur-fast;

    @include hover-capable {
      &:hover {
        background: rgb(var(--clr-surface-rgb) / 0.9);
      }
    }

    @include touch {
      min-height: $touch-target;
      padding-inline: $spacing-lg;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }
  }

  .hero-row {
    display: flex;
    align-items: flex-end;
    gap: $spacing-lg;
    min-width: 0;

    @include respond-to(md) {
      gap: $spacing-md;
    }
  }

  .hero-text {
    min-width: 0;
  }

  .hero-poster {
    flex-shrink: 0;
    width: clamp(84px, 22vw, 180px);
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border-radius: $radius-md;
    box-shadow: 0 8px 30px rgb(var(--clr-shade-rgb) / 0.5);
    transform: translateY(15%);

    @include respond-to(md) {
      transform: none;
    }
  }

  .hero-title {
    font-family: $font-display;
    font-size: clamp(1.6rem, 4vw, 2.8rem);
    overflow-wrap: anywhere;
    line-height: 1.1;
    color: var(--clr-text);
    margin: 0;
    text-shadow: 0 2px 12px rgb(var(--clr-shade-rgb) / 0.6);
  }

  .hero-tagline {
    font-size: 0.92rem;
    color: var(--clr-text-2);
    font-style: italic;
    margin: $spacing-xs 0 0;
  }
</style>
