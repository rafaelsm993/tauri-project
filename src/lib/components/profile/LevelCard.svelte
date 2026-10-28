<script lang="ts">
  import ChartCard from "./ChartCard.svelte";
  import ProfileAvatar from "./ProfileAvatar.svelte";
  import LevelRing from "$lib/components/ui/LevelRing.svelte";
  import type { LevelInfo, Title } from "$lib/domain/gamification";
  let {
    level,
    title,
    xp,
    burst = false,
    onburstend,
    art = "default",
  }: {
    level: LevelInfo;
    title: Title;
    xp: number;
    burst?: boolean;
    onburstend?: () => void;
    art?: string;
  } = $props();
  const toNext = $derived(level.needed - level.into);
</script>

<ChartCard id="level" title="Level" hideTitle area="level">
  <div class="level">
    <div
      class="ring"
      role="img"
      aria-label="Level {level.level}, {level.into} of {level.needed} XP"
      data-burst={burst || undefined}
      onanimationend={onburstend}
    >
      <LevelRing {level} />
      <ProfileAvatar {art} size={32} scale={2} decorative />
    </div>
    <div class="level-text">
      <p class="level-title">{title.name}</p>
      <p class="level-current">Level {level.level}</p>
      <p class="level-xp">{xp} XP · {toNext} XP to level {level.level + 1}</p>
      {#if title.next}<p class="level-next">
          Next title: {title.next.name} at level {title.next.level}
        </p>{/if}
    </div>
  </div>
</ChartCard>

<style lang="scss">
  .level {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-md;
    height: 100%;
    min-width: 0;
  }
  .ring {
    position: relative;
    display: grid;
    place-items: center;
    width: clamp(9rem, 40vw, 11rem);
    max-width: 100%;
    aspect-ratio: 1;
    border-radius: $radius-full;
    &[data-burst] {
      animation: ring-burst 900ms ease-out;
    }
  }
  @keyframes ring-burst {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgb(var(--clr-highlight-rgb) / 0.6);
    }
    35% {
      transform: scale(1.08);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 28px rgb(var(--clr-highlight-rgb) / 0);
    }
  }
  .level-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-xs;
    min-width: 0;
    text-align: center;
  }
  .level-title {
    font-family: $font-display;
    font-size: clamp(1.8rem, 6vw, 2.4rem);
    line-height: 1.1;
    letter-spacing: 0.03em;
    color: var(--clr-primary);
    overflow-wrap: anywhere;
  }
  .level-current {
    font-weight: 600;
    color: var(--clr-text);
  }
  .level-xp {
    font-family: $font-mono;
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }
  .level-next {
    font-size: 0.85rem;
    color: var(--clr-text-3);
  }
</style>
