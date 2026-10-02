<script lang="ts">
  import type { LevelInfo } from "$lib/domain/gamification";

  // Decorative: the label lives on whatever wraps the ring.
  let { level }: { level: LevelInfo } = $props();

  const RADIUS = 21;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const offset = $derived(CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, level.fraction))));
</script>

<svg class="level-ring" viewBox="0 0 48 48" aria-hidden="true">
  <circle class="track" cx="24" cy="24" r={RADIUS} />
  <circle
    class="fill"
    cx="24"
    cy="24"
    r={RADIUS}
    stroke-dasharray={CIRCUMFERENCE}
    stroke-dashoffset={offset}
  />
</svg>

<style lang="scss">
  .level-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    pointer-events: none;
  }

  circle {
    fill: none;
    stroke-width: 3;
  }

  .track {
    stroke: rgb(var(--clr-ink-rgb) / 0.12);
  }

  .fill {
    stroke: var(--clr-primary);
    stroke-linecap: round;
  }
</style>
