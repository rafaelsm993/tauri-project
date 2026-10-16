<script lang="ts">
  import { placeholderOf } from "$lib/domain/manual";
  import type { MediaType } from "$lib/types/media";

  // Fills its box; `caption` adds the whole title under the initial.
  let {
    title,
    type,
    posterKey,
    caption = false,
  }: { title: string; type: MediaType; posterKey?: string; caption?: boolean } = $props();

  const mark = $derived(placeholderOf(title, type));
</script>

<div class="placeholder hue-{mark.family}" aria-hidden="true" data-poster={posterKey}>
  <span class="placeholder__initial">{mark.initial}</span>
  {#if caption}
    <span class="placeholder__caption">{title}</span>
  {/if}
</div>

<style lang="scss">
  .placeholder {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-xs;
    width: 100%;
    height: 100%;
    padding: $spacing-sm;
    background:
      linear-gradient(160deg, rgb(var(--hue) / 0.28) 0%, rgb(var(--hue) / 0.08) 100%),
      var(--clr-surface);
    color: rgb(var(--hue));
    overflow: hidden;
  }

  .placeholder__initial {
    font-family: $font-display;
    font-size: 42cqi;
    line-height: 1;
  }

  .placeholder__caption {
    max-width: 100%;
    font-size: 0.7rem;
    line-height: 1.4;
    text-align: center;
    color: var(--clr-text-2);
    overflow-wrap: anywhere;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
</style>
