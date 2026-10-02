<script lang="ts">
  // `poster`: a 2:3 block (cards, detail). `heading`: a title and a subtitle bar before the lines.
  let {
    poster = false,
    heading = false,
    lines = 1,
  }: { poster?: boolean; heading?: boolean; lines?: number } = $props();
</script>

<div class="skeleton-block" class:text={heading} aria-hidden="true">
  {#if poster}
    <div class="skeleton-poster"></div>
  {/if}
  {#if heading}
    <div class="skeleton-heading"></div>
    <div class="skeleton-subtitle"></div>
  {/if}
  <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- only the index is used -->
  {#each { length: lines } as _, i (i)}
    <div class="skeleton-line"></div>
  {/each}
</div>

<style lang="scss">
  .skeleton-block {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }

  .skeleton-poster,
  .skeleton-heading,
  .skeleton-subtitle,
  .skeleton-line {
    position: relative;
    overflow: hidden;
    background: var(--clr-surface);
    border-radius: $radius-sm;

    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        transparent 0%,
        rgb(var(--clr-ink-rgb) / 0.05) 45%,
        rgb(var(--clr-ink-rgb) / 0.09) 50%,
        rgb(var(--clr-ink-rgb) / 0.05) 55%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.7s ease-in-out infinite;
    }
  }

  .skeleton-poster {
    aspect-ratio: 2 / 3;
    border-radius: $radius-md;
  }

  .skeleton-line {
    height: 9px;
    width: 68%;
  }

  .skeleton-block.text {
    gap: $spacing-sm;

    .skeleton-heading {
      height: 28px;
      width: 60%;
    }

    .skeleton-subtitle {
      height: 14px;
      width: 40%;
      margin-bottom: $spacing-md;
    }

    .skeleton-line {
      height: 14px;
      width: 90%;

      &:nth-last-child(2) {
        width: 85%;
      }

      &:last-child {
        width: 70%;
      }
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
