<script lang="ts">
  import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
  import { unlocksStore } from "$lib/stores/unlocks.svelte";
  import { TITLES } from "$lib/domain/gamification";
  import { earnedTitles, displayedTitle } from "$lib/domain/titles";
  let {
    prefs = prefsStore,
    currentLevel = unlocksStore.level,
  }: { prefs?: PrefsStore; currentLevel?: number | null } = $props();
  const earned = $derived(earnedTitles(prefs.loaded ? (currentLevel ?? 0) : 0));
  const selected = $derived(
    earned.some((t) => t.name === prefs.prefs.title) ? prefs.prefs.title : "automatic",
  );
  const shown = $derived(displayedTitle(currentLevel ?? 1, selected).name);
  const id = $props.id();
  let saving = $state(false);
  let saveError = $state("");
  async function choose(value: string): Promise<void> {
    if (saving || !prefs.loaded || (value !== "automatic" && !earned.some((t) => t.name === value)))
      return;
    saving = true;
    saveError = "";
    if (!(await prefs.update({ title: value }))) saveError = prefs.error;
    saving = false;
  }
</script>

<section id="titles" class="titles-section" aria-labelledby="{id}-heading">
  <h2 id="{id}-heading">Titles</h2>
  <p class="hint">
    Displayed title: <strong>{shown}</strong>. Automatic follows your current level.
  </p>
  {#if prefs.loaded && prefs.prefs.title !== "automatic" && selected === "automatic"}
    <p class="hint">
      Saved choice: {prefs.prefs.title}. Using Automatic until it is available again.
    </p>
  {/if}
  {#if saveError}<p class="save-error" role="status" aria-label="Title save">
      Could not save: {saveError}
    </p>{/if}
  <div class="choices" role="group" aria-label="Title selection">
    {#each [{ name: "Automatic", value: "automatic", level: 0 }, ...TITLES.map( (t) => ({ ...t, value: t.name }) )] as title (title.value)}
      <button
        type="button"
        class="choice"
        aria-label={title.name}
        aria-pressed={selected === title.value}
        aria-describedby="{id}-{title.level}"
        disabled={saving ||
          !prefs.loaded ||
          (title.level > 0 && !earned.some((t) => t.name === title.name))}
        onclick={() => choose(title.value)}
      >
        <strong>{title.name}</strong>
        <span id="{id}-{title.level}"
          >{title.level === 0
            ? "Follows your level"
            : `${earned.some((t) => t.name === title.name) ? "Available from" : "Requires"} level ${title.level}`}</span
        >
      </button>
    {/each}
  </div>
</section>

<style lang="scss">
  .titles-section {
    max-width: 48rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-md;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
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
    font-size: 0.85rem;
    color: var(--clr-text-2);
    overflow-wrap: anywhere;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr));
    gap: $spacing-sm;
  }
  .choice {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
    padding: $spacing-sm;
    background: none;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    color: var(--clr-text);
    font: inherit;
    text-align: left;
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
