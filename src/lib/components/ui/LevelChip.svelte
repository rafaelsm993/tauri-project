<script lang="ts">
  import { resolve } from "$app/paths";
  import LevelRing from "./LevelRing.svelte";
  import type { LevelInfo } from "$lib/domain/gamification";

  let { level, title }: { level: LevelInfo; title: string } = $props();

  const next = $derived(level.level + 1);
</script>

<a class="level-chip" href={resolve("/profile")} aria-label="Level {level.level} · {title}">
  <span
    class="ring"
    role="progressbar"
    aria-label="Progress to level {next}"
    aria-valuemin={0}
    aria-valuemax={level.needed}
    aria-valuenow={level.into}
    aria-valuetext="{level.into} of {level.needed} XP to level {next}"
  >
    <LevelRing {level} />
  </span>
  <span class="number" aria-hidden="true">{level.level}</span>
</a>

<style lang="scss">
  .level-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: $bar-height;
    height: $bar-height;
    pointer-events: auto;
    border-radius: $radius-full;
    background: var(--clr-surface);
    color: rgb(var(--clr-highlight-rgb));
    text-decoration: none;
    transition: background $dur-fast ease;

    @include hover-capable {
      &:hover {
        background: var(--clr-surface-2);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }
  }

  .ring {
    position: absolute;
    inset: 3px;
  }

  .number {
    font-family: $font-display;
    font-size: 1.35rem;
    line-height: 1;
    letter-spacing: 0.03em;
  }
</style>
