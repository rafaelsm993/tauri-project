<!-- Placeholder shown while a detail payload loads. -->
<div class="detail-skeleton">
  <div class="skeleton-hero"></div>
  <div class="skeleton-body">
    <div class="skeleton-poster-ph"></div>
    <div class="skeleton-info">
      <div class="skeleton-line" style="width:60%;height:28px"></div>
      <div class="skeleton-line" style="width:40%;height:14px;margin-top:12px"></div>
      <div class="skeleton-line" style="width:90%;height:14px;margin-top:24px"></div>
      <div class="skeleton-line" style="width:85%;height:14px;margin-top:8px"></div>
      <div class="skeleton-line" style="width:70%;height:14px;margin-top:8px"></div>
    </div>
  </div>
</div>

<style lang="scss">
  .detail-skeleton {
    .skeleton-hero {
      width: 100%;
      height: 420px;
      background: var(--clr-surface);
    }

    .skeleton-body {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: $spacing-xl;
      max-width: 1440px;
      margin-inline: auto;
      padding: $spacing-lg $spacing-xl;
      margin-top: -80px;
      position: relative;
    }

    .skeleton-poster-ph {
      width: 100%;
      aspect-ratio: 2/3;
      background: var(--clr-surface);
      border-radius: $radius-lg;
    }

    .skeleton-info {
      padding-top: 80px;
    }

    .skeleton-line {
      background: var(--clr-surface);
      border-radius: $radius-sm;
      position: relative;
      overflow: hidden;
      &::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          100deg,
          transparent 0%,
          rgb(var(--clr-ink-rgb) / 0.04) 50%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.7s ease-in-out infinite;
      }
    }
  }

  @include respond-to(md) {
    .detail-skeleton .skeleton-body {
      grid-template-columns: 1fr;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
