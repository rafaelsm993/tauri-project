<script lang="ts">
  // Horizontally scrolling gallery (games).
  let { screenshots } = $props<{ screenshots: string[] }>();
</script>

<div class="shots-scroll">
  {#each screenshots as src (src)}
    <img {src} alt="" class="shot-img" loading="lazy" />
  {/each}
</div>

<style lang="scss">
  .shots-scroll {
    display: flex;
    gap: $spacing-md;
    overflow-x: auto;
    padding-bottom: $spacing-sm;

    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgb(var(--clr-ink-rgb) / 0.1);
      border-radius: 2px;
    }
  }

  .shot-img {
    flex: 0 0 auto;
    height: 220px;
    width: auto;
    border-radius: $radius-md;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.05);
    background: var(--clr-surface);
    object-fit: cover;
  }
</style>
