<script lang="ts">
  import Toast from "./Toast.svelte";
  import type { Moment } from "$lib/domain/gamification";

  let {
    moment,
    onclose,
    motion = true,
  }: { moment: Moment | null; onclose: () => void; motion?: boolean } = $props();

  const SHOW_MS = 6_000;
</script>

<Toast open={!!moment} label="Level up" autoHideMs={SHOW_MS} resetKey={moment} {motion} {onclose}>
  {#if moment}
    <p class="toast-text">
      <span class="toast-level">Level {moment.level}</span>
      {#if moment.newTitle}
        <span class="toast-title">New title: {moment.newTitle}</span>
      {/if}
    </p>
  {/if}
</Toast>

<style lang="scss">
  .toast-text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 $spacing-sm;
    min-width: 0;
  }

  .toast-level {
    font-family: $font-display;
    font-size: 1.4rem;
    letter-spacing: 0.03em;
    color: rgb(var(--clr-highlight-rgb));
  }

  .toast-title {
    font-size: 0.9rem;
    color: var(--clr-text-2);
  }
</style>
