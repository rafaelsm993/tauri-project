<script lang="ts">
  import { resolve } from "$app/paths";
  import type { Plant } from "$lib/domain/garden";

  let { plant }: { plant: Plant } = $props();

  const href = $derived(
    resolve("/media/[type]/[id]", { type: plant.type, id: encodeURIComponent(plant.id) }),
  );
</script>

<a
  {href}
  class="plant"
  data-stage={plant.stage}
  data-family={plant.family}
  aria-label={plant.label}
  style:--tilt="{plant.tilt}deg"
  style:--height={plant.height}
  style:--growth={plant.growth}
>
  <span class="plant-art" aria-hidden="true">
    <span class="stem"></span>
    <span class="crown"></span>
  </span>
  <span class="plant-title">{plant.title}</span>
</a>

<style lang="scss">
  // One plant: a stem that grows with --growth and a crown in its family hue.
  .plant {
    --crown: rgb(var(--clr-hue-screen-rgb));
    --stem: rgb(var(--clr-teal-rgb) / 0.8);

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-xs;
    min-width: 0;
    padding-bottom: $spacing-xs;
    text-decoration: none;
    color: var(--clr-text-2);
    border-radius: $radius-sm;

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .plant-art {
    position: relative;
    display: block;
    width: 100%;
    height: calc(5rem * var(--height));
    transform: rotate(var(--tilt));
    transform-origin: bottom center;
  }

  .stem {
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 3px;
    height: calc(18% + 62% * var(--growth));
    translate: -50% 0;
    border-radius: $radius-full;
    background: var(--stem);
  }

  .crown {
    position: absolute;
    left: 50%;
    bottom: calc(18% + 62% * var(--growth));
    width: calc(0.7rem + 0.9rem * var(--growth));
    aspect-ratio: 1;
    translate: -50% 40%;
    background: var(--crown);
    border-radius: $radius-full;
  }

  .plant[data-family="screen"] {
    --crown: rgb(var(--clr-hue-screen-rgb));
  }

  .plant[data-family="anime"] {
    --crown: rgb(var(--clr-hue-anime-rgb));
  }

  .plant[data-family="manga"] {
    --crown: rgb(var(--clr-hue-manga-rgb));
  }

  .plant[data-family="book"] {
    --crown: rgb(var(--clr-hue-book-rgb));
  }

  .plant[data-family="game"] {
    --crown: rgb(var(--clr-hue-game-rgb));
  }

  // A seed is still underground: a low mound, no crown in the air yet.
  .plant[data-stage="seed"] {
    --stem: rgb(var(--clr-ink-rgb) / 0.25);

    .crown {
      width: 0.75rem;
      height: 0.4rem;
      aspect-ratio: auto;
      border-radius: $radius-full $radius-full 0 0;
      background: rgb(var(--clr-ink-rgb) / 0.4);
    }
  }

  // Dropped rests: grey and low, never wilted (GOALS §5.3 — no loss aversion).
  .plant[data-stage="dormant"] {
    --crown: rgb(var(--clr-ink-rgb) / 0.3);
    --stem: rgb(var(--clr-ink-rgb) / 0.2);

    opacity: 0.75;
  }

  // A bloom gets a second ring, so finishing reads at a glance.
  .plant[data-stage="bloom"] .crown {
    box-shadow: 0 0 0 4px rgb(var(--clr-highlight-rgb) / 0.3);
  }

  .plant[data-family="screen"] .crown {
    border-radius: $radius-sm;
  }

  .plant[data-family="book"] .crown,
  .plant[data-family="manga"] .crown {
    border-radius: $radius-sm $radius-sm $radius-sm 0;
  }

  .plant[data-family="game"] .crown {
    rotate: 45deg;
    border-radius: 2px;
  }

  .plant[data-family="anime"] .crown {
    border-radius: $radius-full 2px $radius-full 2px;
  }

  // Titles would crowd a phone; the accessible name carries them at every width.
  .plant-title {
    max-width: 100%;
    font-size: 0.7rem;
    text-align: center;
    @include truncate;

    @include respond-to(md) {
      display: none;
    }
  }
</style>
