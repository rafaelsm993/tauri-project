<script lang="ts">
  // Horizontally scrolling cast list; mouse users can drag it.
  import type { CastMember } from "$lib/types/media";
  import { initials } from "$lib/utils/format";

  let { cast } = $props<{ cast: CastMember[] }>();

  let castEl = $state<HTMLDivElement | undefined>(undefined);
  let dragging = $state(false);
  let dragStartX = 0;
  let scrollStart = 0;

  function onDragStart(e: MouseEvent) {
    if (!castEl) return;
    dragging = true;
    dragStartX = e.clientX;
    scrollStart = castEl.scrollLeft;
  }

  function onDragMove(e: MouseEvent) {
    if (!dragging || !castEl) return;
    e.preventDefault();
    castEl.scrollLeft = scrollStart - (e.clientX - dragStartX);
  }

  function onDragEnd() {
    dragging = false;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="cast-scroll"
  role="list"
  class:grabbing={dragging}
  bind:this={castEl}
  onmousedown={onDragStart}
  onmousemove={onDragMove}
  onmouseup={onDragEnd}
  onmouseleave={onDragEnd}
>
  {#each cast as member (member.id)}
    <div class="cast-card">
      {#if member.profile_path}
        <img src={member.profile_path} alt={member.name} class="cast-photo" loading="lazy" />
      {:else}
        <div class="cast-photo-placeholder" aria-hidden="true">
          {initials(member.name)}
        </div>
      {/if}
      <span class="cast-name">{member.name}</span>
      <span class="cast-character">{member.character}</span>
    </div>
  {/each}
</div>

<style lang="scss">
  .cast-scroll {
    display: flex;
    gap: $spacing-md;
    overflow-x: auto;
    padding-bottom: $spacing-sm;
    cursor: grab;
    user-select: none;

    &.grabbing {
      cursor: grabbing;
      scroll-behavior: auto;
    }

    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgb(var(--clr-ink-rgb) / 0.1);
      border-radius: 2px;
    }
  }

  .cast-card {
    flex: 0 0 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 4px;
  }

  .cast-photo {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--clr-surface);
  }

  .cast-photo-placeholder {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      rgb(var(--clr-primary-rgb) / 0.18),
      rgb(var(--clr-accent-rgb) / 0.18)
    );
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--clr-text);
    font-family: $font-display;
    font-size: 1.2rem;
    letter-spacing: 0.04em;
    user-select: none;
  }

  .cast-name {
    font-size: 0.72rem;
    color: var(--clr-text);
    font-weight: 500;
    @include truncate;
    max-width: 100%;
  }

  .cast-character {
    font-size: 0.66rem;
    color: var(--clr-text-3);
    @include truncate;
    max-width: 100%;
  }
</style>
