<script lang="ts">
  import RewardPicker, { type PickerChoice } from "./RewardPicker.svelte";
  import RewardPreview from "./RewardPreview.svelte";
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
  }: {
    prefs?: PrefsStore;
    currentLevel?: number | null;
  } = $props();
  const equipment = $derived(new UnlocksStore(prefs, () => currentLevel));
  const motion = $derived(new MotionStore(prefs));
  const slots: { slot: Slot; label: string }[] = [
    { slot: "accent", label: "Accent" },
    { slot: "pack", label: "Palette" },
    { slot: "motif", label: "Background" },
    { slot: "garden", label: "Tree effect" },
  ];
  const bases: { value: Theme; label: string }[] = [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ];
  let saving = $state(false);
  let saveError = $state("");
  const blocked = (slot: Slot) => (slot === "motif" || slot === "garden") && !motion.on;

  function reason(slot: Slot, reward: { id: string; level: number }): string {
    if (!prefs.loaded) return "Settings unavailable";
    if (reward.level > equipment.level) return `Requires level ${reward.level}`;
    if (slot === "pack" && !equipment.canEquip(slot, reward.id))
      return `Requires ${PACKS[reward.id]?.base} theme`;
    return blocked(slot) ? "Available · Animations are off or reduced" : "Available";
  }

  function choices(slot: Slot): PickerChoice[] {
    return [
      { id: "default", label: "Default", level: 0 },
      ...UNLOCKS.filter((u) => u.kind === slot),
    ].map((reward) => ({
      value: reward.id,
      label: reward.label,
      hint: reason(slot, reward),
      disabled: !prefs.loaded || blocked(slot) || !equipment.canEquip(slot, reward.id),
    }));
  }

  async function choose(slot: Slot, reward: string): Promise<boolean> {
    if (saving || !prefs.loaded || blocked(slot) || !equipment.canEquip(slot, reward)) return false;
    saving = true;
    saveError = "";
    try {
      await equipment.equip(slot, reward);
      saveError = prefs.error;
      return !saveError;
    } finally {
      saving = false;
    }
  }
</script>

<section id="theme" class="theme-section" aria-label="Theme">
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
    </p>
  {:else}<p class="hint">Every level reward is unlocked.</p>{/if}
  {#if saveError}<p class="save-error" role="status" aria-label="Theme save">
      Could not save: {saveError}
    </p>{/if}
  {#each slots as { slot, label } (slot)}
    <div class="slot">
      <RewardPicker
        {label}
        value={equipment[slot]}
        options={choices(slot)}
        allowReselect={prefs.prefs[slot] !== equipment[slot]}
        disabled={saving || !prefs.ready || !prefs.loaded}
        onchange={(reward) => choose(slot, reward)}
      >
        {#snippet preview(option)}<span class="thumbnail"
            ><RewardPreview {slot} reward={option.value} label={option.label} /></span
          >{/snippet}
      </RewardPicker>
      {#if prefs.loaded && prefs.prefs[slot] !== equipment[slot]}<p class="hint">
          Saved choice: {UNLOCKS.find((u) => u.id === prefs.prefs[slot])?.label ??
            prefs.prefs[slot]}. Using Default until it is available again.
        </p>{/if}
      {#if slot === "motif"}<p class="hint">
          Backgrounds draw only on the desktop app; phones stay still.
        </p>
      {:else if slot === "garden"}<p class="hint">
          A brief rune reveal when the tree opens; no continuous animation.
        </p>{/if}
    </div>
  {/each}
</section>

<style lang="scss">
  .theme-section {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-width: 0;
  }
  .slot {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }
  .thumbnail {
    display: block;
    width: 100%;
    min-width: 0;
  }
  .hint {
    font-size: 0.8rem;
    color: var(--clr-text-2);
    overflow-wrap: anywhere;
  }
  .save-error {
    color: var(--clr-error);
    font-size: 0.85rem;
  }
</style>
