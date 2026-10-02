<script lang="ts">
  import Skeleton from "$lib/components/ui/Skeleton.svelte";
</script>

<div class="detail-skeleton" aria-hidden="true">
  <div class="skeleton-hero"></div>
  <div class="skeleton-body">
    <Skeleton poster lines={0} />
    <div class="skeleton-info">
      <Skeleton heading lines={3} />
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

    .skeleton-body > :global(.skeleton-block .skeleton-poster) {
      border-radius: $radius-lg;
    }

    .skeleton-info {
      padding-top: 80px;
    }
  }

  @include respond-to(md) {
    .detail-skeleton .skeleton-body {
      grid-template-columns: 1fr;
    }
  }
</style>
