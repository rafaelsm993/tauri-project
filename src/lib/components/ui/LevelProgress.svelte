<script lang="ts">
  import type { LevelInfo } from "$lib/domain/gamification";

  let { level }: { level: LevelInfo } = $props();

  const next = $derived(level.level + 1);
  const percent = $derived(Math.min(100, Math.max(0, level.fraction * 100)));
</script>

<div
  class="level-progress"
  role="progressbar"
  aria-label="Progress to level {next}"
  aria-valuemin={0}
  aria-valuemax={level.needed}
  aria-valuenow={level.into}
  aria-valuetext="{level.into} of {level.needed} XP to level {next}"
>
  <span class="fill" style:width="{percent}%"></span>
</div>

<style lang="scss">
  .level-progress {
    width: 100%;
    height: 6px;
    overflow: hidden;
    border-radius: $radius-full;
    background: rgb(var(--clr-ink-rgb) / 0.08);
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--clr-primary);
  }
</style>
