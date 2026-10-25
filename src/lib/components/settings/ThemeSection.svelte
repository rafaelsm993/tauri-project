<script lang="ts">
  import RewardPreview from "./RewardPreview.svelte";
  import ProfileArtworkSection from "./ProfileArtworkSection.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import type { LibraryEntry } from "$lib/types/library";
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import type { Theme } from "$lib/types/prefs";
  import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
  import { UnlocksStore, unlocksStore, type Slot } from "$lib/stores/unlocks.svelte";
  import { UNLOCKS } from "$lib/domain/unlocks";
  import { PACKS } from "$lib/domain/themes";
  import { MotionStore } from "$lib/stores/motion.svelte";
  let {
    prefs = prefsStore,
    currentLevel = unlocksStore.level,
    currentEntries = libraryStore.ready ? libraryStore.entries : null,
  }: {
    prefs?: PrefsStore;
    currentLevel?: number | null;
    currentEntries?: LibraryEntry[] | null;
  } = $props();
  const equipment = $derived(new UnlocksStore(prefs, () => currentLevel));
  const slots: { slot: Slot; label: string }[] = [
    { slot: "accent", label: "Accent" },
    { slot: "pack", label: "Palette" },
    { slot: "motif", label: "Background" },
    { slot: "garden", label: "Garden" },
  ];
  const id = $props.id();
  const bases: { value: Theme; label: string }[] = [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ];
  let saving = $state(false);
  let saveError = $state("");
  async function choose(slot: Slot, reward: string): Promise<void> {
    if (saving || !prefs.loaded || blocked(slot) || !equipment.canEquip(slot, reward)) return;
    saving = true;
    saveError = "";
    await equipment.equip(slot, reward);
    saveError = prefs.error;
    saving = false;
  }
  const motion = $derived(new MotionStore(prefs));
  const blocked = (slot: Slot) => (slot === "motif" || slot === "garden") && !motion.on;
  function reason(slot: Slot, reward: { id: string; level: number }): string {
    if (!prefs.loaded) return "Settings unavailable";
    if (reward.level > equipment.level) return `Requires level ${reward.level}`;
    if (slot === "pack" && !equipment.canEquip(slot, reward.id))
      return `Requires ${PACKS[reward.id]?.base} theme`;
    return blocked(slot) ? "Available · Animations are off or reduced" : "Available";
  }
</script>

<section class="theme-section" aria-labelledby="{id}-heading">
  <h2 id="{id}-heading">Theme</h2>
  <p class="hint">System follows your device's light or dark setting.</p>
  <SegmentedControl
    label="Theme"
    options={bases}
    value={prefs.prefs.theme}
    disabled={saving || !prefs.ready || !prefs.loaded}
    onchange={(theme) => prefs.update({ theme })}
  />
  {#if equipment.next}<p class="hint">
      Next at level {equipment.next.level}: <strong>{equipment.next.label}</strong> — {equipment
        .next.blurb}
    </p>{:else}<p class="hint">Every level reward is unlocked.</p>{/if}
  {#if saveError}<p class="save-error" role="status" aria-label="Theme save">
      Could not save: {saveError}
    </p>{/if}
  {#each slots as { slot, label } (slot)}
    <div class="slot" role="group" aria-label={label}>
      <h3>{label}</h3>
      {#if prefs.loaded && prefs.prefs[slot] !== equipment[slot]}
        <p class="hint">
          Saved choice: {UNLOCKS.find((u) => u.id === prefs.prefs[slot])?.label ??
            prefs.prefs[slot]}. Using Default until it is available again.
        </p>
      {/if}
      {#if slot === "motif" || slot === "garden"}
        <p class="hint">
          {slot === "motif" ? "Backgrounds draw" : "The garden sway runs"} only on the desktop app; phones
          stay still.
        </p>
      {/if}
      <div class="choices">
        {#each [{ id: "default", label: "Default", level: 0 }, ...UNLOCKS.filter((u) => u.kind === slot)] as reward (reward.id)}
          <button
            type="button"
            class="reward"
            aria-label={reward.label}
            aria-pressed={equipment[slot] === reward.id}
            aria-describedby="{id}-{reward.id}-{slot}"
            onclick={() => choose(slot, reward.id)}
            disabled={saving ||
              !prefs.loaded ||
              !equipment.canEquip(slot, reward.id) ||
              blocked(slot)}
          >
            <RewardPreview {slot} reward={reward.id} label={reward.label} />
            <strong>{reward.label}</strong>
            <span id="{id}-{reward.id}-{slot}">{reason(slot, reward)}</span>
          </button>
        {/each}
      </div>
    </div>
  {/each}
  <ProfileArtworkSection {prefs} {currentLevel} entries={currentEntries} />
</section>

<style lang="scss">
  .theme-section {
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
    max-width: 48rem;
    min-width: 0;
    padding: $spacing-md;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
    background: var(--clr-surface);
  }
  h2 {
    font-size: 1rem;
    font-weight: 600;
  }
  .save-error {
    color: var(--clr-error);
    font-size: 0.85rem;
  }
  .hint {
    font-size: 0.8rem;
    color: var(--clr-text-2);
    margin-bottom: $spacing-sm;
    overflow-wrap: anywhere;
  }
  h3 {
    font-size: 0.85rem;
    color: var(--clr-text-2);
    margin-bottom: $spacing-sm;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr));
    gap: $spacing-sm;
  }
  .reward {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
    padding: $spacing-sm;
    min-width: 0;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: none;
    color: var(--clr-text);
    text-align: left;
    font: inherit;
    cursor: pointer;
    strong {
      font-size: 0.85rem;
    }
    span {
      font-size: 0.75rem;
    }
    &[aria-pressed="true"] {
      background: var(--clr-primary);
      color: var(--clr-on-primary);
      border-color: transparent;
    }
    &:disabled {
      cursor: not-allowed;
    }
    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }
    @include touch {
      min-height: $touch-target;
    }
    @include hover-capable {
      &:hover:not(:disabled) {
        border-color: var(--clr-accent);
      }
    }
  }
</style>
