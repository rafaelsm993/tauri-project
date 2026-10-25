<script lang="ts">
  import ProfileArtwork from "$lib/components/profile/ProfileArtwork.svelte";
  import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
  import { UnlocksStore, unlocksStore } from "$lib/stores/unlocks.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { COMPLETION_TYPES } from "$lib/domain/completionAchievements";
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
  const labels = {
    movie: "Movies",
    tv: "TV",
    anime: "Anime",
    manga: "Manga",
    book: "Books",
    game: "Games",
  };
  const id = $props.id();
  let saving = $state(false);
  let saveError = $state("");
  async function choose(art: string) {
    if (saving || !equipment.canEquipArt(art)) return;
    saving = true;
    saveError = "";
    if (!(await equipment.equipArt(art))) saveError = prefs.error;
    saving = false;
  }
</script>

<section class="artwork-section" aria-labelledby="{id}-heading">
  <h3 id="{id}-heading">Profile artwork</h3>
  <p class="hint">
    Completion crests appear in Profile and navigation. Both the current level and completed count
    are required.
  </p>
  {#if prefs.loaded && prefs.prefs.profile_art !== equipment.profileArt}
    <p class="hint">
      Saved choice: {saved ? `${saved.name} tier ${saved.tier}` : prefs.prefs.profile_art}. Using
      Default until it is available again.
    </p>
  {/if}
  {#if !entries || !currentLevel}<p class="hint">
      Library or activity unavailable. Earned artwork will return after a successful load.
    </p>{/if}
  {#if saveError}<p class="save-error" role="status" aria-label="Artwork save">
      Could not save: {saveError}
    </p>{/if}
  <button
    type="button"
    class="default-choice"
    aria-label="Default artwork"
    aria-pressed={equipment.profileArt === "default"}
    disabled={saving || !prefs.loaded}
    onclick={() => choose("default")}>Default</button
  >
  {#each COMPLETION_TYPES as type (type)}
    <div role="group" aria-label="{labels[type]} artwork">
      <h4>{labels[type]}</h4>
      <div class="choices">
        {#each equipment.artRewards.filter((art) => art.type === type) as art (art.id)}
          <button
            type="button"
            class="art-choice"
            aria-label="{art.name} tier {art.tier}"
            aria-describedby="{id}-{art.id}"
            aria-pressed={equipment.profileArt === art.id}
            disabled={saving || !equipment.canEquipArt(art.id)}
            onclick={() => choose(art.id)}
          >
            <ProfileArtwork art={art.id} size={32} scale={2} decorative />
            <strong>{art.name} · {art.tier}</strong>
            <span id="{id}-{art.id}" class="requirements"
              ><span>{art.count} / {art.required} completed</span><span
                >{art.unlocked ? "Available from" : "Requires"} level {art.level}</span
              ></span
            >
          </button>
        {/each}
      </div>
    </div>
  {/each}
</section>

<style lang="scss">
  .artwork-section {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-width: 0;
  }
  h3,
  h4 {
    font-size: 0.85rem;
    font-weight: 600;
  }
  h4 {
    margin-bottom: $spacing-sm;
    color: var(--clr-text-2);
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
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr));
    gap: $spacing-sm;
  }
  button {
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: none;
    color: var(--clr-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    min-width: 0;
    padding: $spacing-sm;
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
  .art-choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
    strong {
      font-size: 0.8rem;
    }
    span {
      font-size: 0.75rem;
    }
  }
  .requirements {
    display: flex;
    flex-direction: column;
  }
  .default-choice {
    align-self: flex-start;
    font-size: 0.85rem;
  }
</style>
