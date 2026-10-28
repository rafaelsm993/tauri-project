<script lang="ts">
  import RewardPicker from "./RewardPicker.svelte";
  import ProfileAvatar from "$lib/components/profile/ProfileAvatar.svelte";
  import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
  import { UnlocksStore, unlocksStore } from "$lib/stores/unlocks.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { PROFILE_ART } from "$lib/domain/profileArt";
  import type { LibraryEntry } from "$lib/types/library";

  let {
    prefs = prefsStore,
    currentLevel = unlocksStore.level,
    entries = libraryStore.ready ? libraryStore.entries : null,
  }: {
    prefs?: PrefsStore;
    currentLevel?: number | null;
    entries?: LibraryEntry[] | null;
  } = $props();
  const equipment = $derived(
    new UnlocksStore(
      prefs,
      () => currentLevel,
      () => entries,
    ),
  );
  const saved = $derived(PROFILE_ART.find((art) => art.id === prefs.prefs.profile_art));
  let saving = $state(false);
  let saveError = $state("");
  const options = $derived([
    {
      value: "default",
      label: "Default avatar",
      hint: "No completion crest",
      disabled: !prefs.loaded,
    },
    ...equipment.artRewards
      .filter((art) => art.unlocked)
      .map((art) => ({
        value: art.id,
        label: `${art.name} tier ${art.tier}`,
        hint: `${art.count} / ${art.required} completed · ${art.unlocked ? "Available from" : "Requires"} level ${art.level}`,
        disabled: !equipment.canEquipArt(art.id),
      })),
  ]);

  async function choose(art: string): Promise<boolean> {
    if (saving || !equipment.canEquipArt(art)) return false;
    saving = true;
    saveError = "";
    try {
      const ok = await equipment.equipArt(art);
      if (!ok) saveError = prefs.error;
      return ok;
    } finally {
      saving = false;
    }
  }
</script>

<section id="profile-artwork" class="artwork-section" aria-label="Avatar">
  <RewardPicker
    label="Avatar"
    imageOnly
    value={equipment.profileArt}
    {options}
    allowReselect={prefs.prefs.profile_art !== equipment.profileArt}
    disabled={saving || !prefs.ready || !prefs.loaded}
    onchange={choose}
  >
    {#snippet preview(option)}
      <ProfileAvatar art={option.value} size={32} decorative />
    {/snippet}
  </RewardPicker>
  <p class="hint">
    Choose an unlocked avatar. Preview locked avatars and their requirements in the Journey Tree.
  </p>
  {#if prefs.loaded && prefs.prefs.profile_art !== equipment.profileArt}<p class="hint">
      Saved choice: {saved ? `${saved.name} tier ${saved.tier}` : prefs.prefs.profile_art}. Using
      Default until it is available again.
    </p>{/if}
  {#if !entries || !currentLevel}<p class="hint">
      Library or activity unavailable. Earned artwork will return after a successful load.
    </p>{/if}
  {#if saveError}<p class="save-error" role="status" aria-label="Artwork save">
      Could not save: {saveError}
    </p>{/if}
</section>

<style lang="scss">
  .artwork-section {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }
  .hint {
    font-size: 0.8rem;
    color: var(--clr-text-2);
    overflow-wrap: anywhere;
  }
  .save-error {
    font-size: 0.85rem;
    color: var(--clr-error);
  }
</style>
