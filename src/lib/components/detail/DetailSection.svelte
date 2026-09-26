<script lang="ts">
  // Titled section of the detail page (trailer, screenshots, cast).
  import type { Snippet } from "svelte";

  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="detail-section">
  <h3 class="section-title">{title}</h3>
  {@render children()}
</div>

<style lang="scss">
  .detail-section {
    margin-bottom: $spacing-xl;
  }

  .section-title {
    @include label-style;
    margin-bottom: $spacing-md;
  }
</style>
