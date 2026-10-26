<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { completionAchievements } from "$lib/domain/completionAchievements";
  import { TITLES } from "$lib/domain/gamification";
  import { UNLOCKS, type UnlockKind } from "$lib/domain/unlocks";
  import type { LibraryEntry } from "$lib/types/library";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import ProfileArtwork from "$lib/components/profile/ProfileArtwork.svelte";
  import RewardPreview from "$lib/components/settings/RewardPreview.svelte";

  let {
    kind,
    rewardId,
    entries,
    currentLevel,
    onclose,
  }: {
    kind: UnlockKind | "title" | "art";
    rewardId: string;
    entries: LibraryEntry[];
    currentLevel: number | null;
    onclose: () => void;
  } = $props();
  let navigating = $state(false);
  const art = $derived(
    kind === "art"
      ? completionAchievements(entries, currentLevel ?? 0).find((reward) => reward.id === rewardId)
      : undefined,
  );
  const title = $derived(
    kind === "title" ? TITLES.find((reward) => reward.name === rewardId) : undefined,
  );
  const theme = $derived(UNLOCKS.find((reward) => reward.kind === kind && reward.id === rewardId));
  const label = $derived(
    art ? `${art.name} tier ${art.tier}` : (title?.name ?? theme?.label ?? "Reward unavailable"),
  );
  const level = $derived(art?.level ?? title?.level ?? theme?.level);
  const earned = $derived(
    currentLevel !== null && level !== undefined && currentLevel >= level && (!art || art.unlocked),
  );
  const section = $derived(kind === "art" ? "artwork" : kind === "title" ? "titles" : "Theme");
  const anchor = $derived(
    kind === "art" ? "profile-artwork" : kind === "title" ? "titles" : "theme",
  );
</script>

<Sheet
  {label}
  {onclose}
  focus="sheet"
  onclosed={() => {
    if (navigating) void goto(resolve(`/settings#${anchor}`));
  }}
>
  <section class="reward-sheet">
    <header>
      <h2>{label}</h2>
      <button type="button" onclick={onclose}>Close preview</button>
    </header>
    {#if level !== undefined}
      {#if art}<ProfileArtwork art={art.id} size={32} scale={3} />
      {:else if theme}<RewardPreview label={theme.label} slot={theme.kind} reward={theme.id} />{/if}
      {#if art}<p>{art.count} / {art.required} completed</p>{/if}
      <p>Requires level {level}</p>
      <p class:earned>
        {currentLevel === null
          ? "Progression unavailable"
          : earned
            ? "Available"
            : "Requirements not met"}
      </p>
      {#if theme}<p>{theme.blurb}</p>{/if}
      <p>Preview only. Choose equipment in Settings.</p>
      <a
        href={resolve(`/settings#${anchor}`)}
        onclick={(event) => {
          if (
            event.button === 0 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            event.preventDefault();
            navigating = true;
            onclose();
          }
        }}>Open {section} in Settings</a
      >
    {:else}<p>Reward unavailable</p>{/if}
  </section>
</Sheet>

<style lang="scss">
  .reward-sheet {
    width: min(32rem, 100%);
    padding: $spacing-lg;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-md;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
    background: var(--clr-surface);
  }
  header {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
  }
  h2 {
    font-size: 1.1rem;
    overflow-wrap: anywhere;
  }
  p {
    color: var(--clr-text-2);
  }
  .earned {
    color: var(--clr-text);
    font-weight: 600;
  }
  a,
  button {
    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    padding: $spacing-sm;
    border: 1px solid var(--clr-border);
    background: var(--clr-bg);
    color: var(--clr-text);
    cursor: pointer;
  }
  a {
    background: var(--clr-primary);
    color: var(--clr-on-primary);
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--clr-accent);
    outline-offset: 2px;
  }
</style>
