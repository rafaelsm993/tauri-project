<script lang="ts">
  import RewardPicker from "./RewardPicker.svelte";
  import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
  import { unlocksStore } from "$lib/stores/unlocks.svelte";
  import { TITLES } from "$lib/domain/gamification";
  import { earnedTitles, displayedTitle } from "$lib/domain/titles";

  let {
    prefs = prefsStore,
    currentLevel = unlocksStore.level,
  }: {
    prefs?: PrefsStore;
    currentLevel?: number | null;
  } = $props();
  const earned = $derived(earnedTitles(prefs.loaded ? (currentLevel ?? 0) : 0));
  const selected = $derived(
    earned.some((t) => t.name === prefs.prefs.title) ? prefs.prefs.title : "automatic",
  );
  const shown = $derived(displayedTitle(currentLevel ?? 1, selected).name);
  const options = $derived([
    {
      value: "automatic",
      label: "Automatic",
      hint: `Follows your level · ${displayedTitle(currentLevel ?? 1, "automatic").name}`,
      disabled: !prefs.loaded,
    },
    ...TITLES.map((title) => ({
      value: title.name,
      label: title.name,
      hint: `${earned.some((t) => t.name === title.name) ? "Available from" : "Requires"} level ${title.level}`,
      disabled: !prefs.loaded || !earned.some((t) => t.name === title.name),
    })),
  ]);
  let saving = $state(false);
  let saveError = $state("");

  async function choose(value: string): Promise<boolean> {
    if (saving || !prefs.loaded || (value !== "automatic" && !earned.some((t) => t.name === value)))
      return false;
    saving = true;
    saveError = "";
    try {
      const ok = await prefs.update({ title: value });
      if (!ok) saveError = prefs.error;
      return ok;
    } finally {
      saving = false;
    }
  }
</script>

<section id="titles" class="titles-section" aria-label="Titles">
  <RewardPicker
    label="Title"
    value={selected}
    {options}
    allowReselect={prefs.prefs.title !== selected}
    disabled={saving || !prefs.ready || !prefs.loaded}
    onchange={choose}
  />
  <p class="hint">
    Displayed title: <strong>{shown}</strong>. Automatic follows your current level.
  </p>
  {#if prefs.loaded && prefs.prefs.title !== "automatic" && selected === "automatic"}<p
      class="hint"
    >
      Saved choice: {prefs.prefs.title}. Using Automatic until it is available again.
    </p>{/if}
  {#if saveError}<p class="save-error" role="status" aria-label="Title save">
      Could not save: {saveError}
    </p>{/if}
</section>

<style lang="scss">
  .titles-section {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
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
