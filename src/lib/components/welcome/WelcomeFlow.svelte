<script lang="ts">
  import GardenScene from "$lib/components/garden/GardenScene.svelte";
  import { SAMPLE_GARDEN } from "$lib/domain/sampleGarden";
  import { FAMILIES, FAMILY_LABELS, type Family } from "$lib/domain/dashboard";
  import { beatAfter, beatBefore, isLastBeat, resumeBeat, type Beat } from "$lib/domain/welcome";
  import { keysStore, KeysStore } from "$lib/stores/keys.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import { BEATS } from "$lib/domain/welcome";
  import type { Keyed } from "$lib/api/keys";
  import { untrack } from "svelte";

  let {
    prefs = prefsStore,
    keys = keysStore,
    ondone,
  }: { prefs?: PrefsStore; keys?: KeysStore; ondone: () => void } = $props();

  // Seeded once from the saved run; the flow owns them from here on.
  let beat = $state<Beat>(untrack(() => resumeBeat(prefs.prefs.welcome_beat)));
  let picked = $state<Family[]>(untrack(() => [...(prefs.prefs.taste_families as Family[])]));
  let drafts = $state<Record<string, string>>({ tmdb: "", rawg: "" });

  const PROVIDERS: { which: Keyed; label: string; serves: string }[] = [
    { which: "tmdb", label: "TMDB key", serves: "Movies and TV shows" },
    { which: "rawg", label: "RAWG key", serves: "Games" },
  ];

  async function go(next: Beat) {
    beat = next;
    await prefs.update({ welcome_beat: BEATS.indexOf(next) });
  }

  async function finish() {
    await prefs.update({
      welcomed: true,
      welcome_beat: 0,
      taste_families: picked,
    });
    ondone();
  }

  async function forward() {
    if (beat === "taste") await prefs.update({ taste_families: picked });
    const next = beatAfter(beat);
    if (next === null) await finish();
    else await go(next);
  }

  function toggle(family: Family) {
    picked = picked.includes(family) ? picked.filter((f) => f !== family) : [...picked, family];
  }

  async function saveKey(which: Keyed) {
    if (await keys.save(which, drafts[which])) drafts = { ...drafts, [which]: "" };
  }

  const back = $derived(beatBefore(beat));
</script>

<div class="welcome">
  <div class="welcome-beat">
    {#if beat === "garden"}
      <h1 class="welcome-title">Your library is a thing you grow</h1>
      <p class="welcome-text">
        Everything you save takes root here. Finish something and it blooms; set something aside and
        it rests. This is an example &mdash; yours starts empty.
      </p>
      <div class="welcome-garden">
        <GardenScene entries={SAMPLE_GARDEN} motion={false} />
      </div>
    {:else if beat === "keys"}
      <h1 class="welcome-title">Bring your own keys</h1>
      <p class="welcome-text">
        Movies, TV and games come from providers that ask for a free key of your own. Books, anime
        and manga need nothing. You can add keys later in Settings.
      </p>
      <div class="welcome-keys">
        {#each PROVIDERS as provider (provider.which)}
          <div class="welcome-key">
            <label class="welcome-key-name" for="welcome-{provider.which}">
              {provider.label}
            </label>
            <span class="welcome-key-serves">{provider.serves}</span>
            <div class="welcome-key-row">
              <input
                id="welcome-{provider.which}"
                type="password"
                class="welcome-input"
                autocomplete="off"
                spellcheck="false"
                placeholder={keys.presence[provider.which] ? "Saved" : "Paste your key"}
                bind:value={drafts[provider.which]}
              />
              <button
                type="button"
                class="welcome-btn"
                disabled={keys.busy || drafts[provider.which].trim().length === 0}
                onclick={() => saveKey(provider.which)}
              >
                Save
              </button>
            </div>
            {#if keys.presence[provider.which]}
              <p class="welcome-key-ok">Saved and working.</p>
            {/if}
            {#if keys.errorFor(provider.which)}
              <p class="welcome-key-bad">{keys.errorFor(provider.which)}</p>
            {/if}
          </div>
        {/each}
      </div>
    {:else if beat === "taste"}
      <h1 class="welcome-title">What do you want to track?</h1>
      <p class="welcome-text">
        Pick anything that sounds like you. It only decides what the home screen shows first, and
        you can change it any time.
      </p>
      <div class="welcome-tiles">
        {#each FAMILIES as family (family)}
          <button
            type="button"
            class="welcome-tile"
            class:picked={picked.includes(family)}
            aria-pressed={picked.includes(family)}
            onclick={() => toggle(family)}
          >
            {FAMILY_LABELS[family]}
          </button>
        {/each}
      </div>
    {:else}
      <h1 class="welcome-title">Plan it when you are ready</h1>
      <p class="welcome-text">
        The planner turns what you are watching and reading into sessions for the week ahead. It is
        there when you want it, and quiet when you do not.
      </p>
    {/if}
  </div>

  <div class="welcome-actions">
    <button type="button" class="welcome-skip" onclick={finish}>Skip</button>
    <div class="welcome-move">
      {#if back !== null}
        <button type="button" class="welcome-btn" onclick={() => go(back)}>Back</button>
      {/if}
      {#if beat === "keys"}
        <button type="button" class="welcome-btn welcome-btn-go" onclick={forward}>
          Continue without keys
        </button>
      {:else}
        <button type="button" class="welcome-btn welcome-btn-go" onclick={forward}>
          {isLastBeat(beat) ? "Start" : "Next"}
        </button>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .welcome {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: $spacing-lg;
    min-height: 100%;
    min-width: 0;
  }

  .welcome-beat {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-width: 0;
  }

  .welcome-title {
    font-family: $font-display;
    font-size: clamp(1.6rem, 6vw, 2.6rem);
    line-height: 1.1;
    color: var(--clr-text);
  }

  .welcome-text {
    max-width: 48ch;
    font-size: 0.95rem;
    color: var(--clr-text-2);
  }

  .welcome-garden {
    padding: $spacing-md;
    border-radius: $radius-md;
    background: var(--clr-surface-2);
    min-width: 0;
  }

  .welcome-keys {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-md;
  }

  .welcome-key {
    display: flex;
    flex: 1 1 16rem;
    flex-direction: column;
    gap: $spacing-xs;
    padding: $spacing-md;
    border-radius: $radius-md;
    background: var(--clr-surface-2);
    min-width: 0;
  }

  .welcome-key-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .welcome-key-serves {
    font-size: 0.8rem;
    color: var(--clr-text-3);
  }

  .welcome-key-row {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
    min-width: 0;
  }

  .welcome-key-ok {
    font-size: 0.8rem;
    color: var(--clr-teal);
  }

  .welcome-key-bad {
    font-size: 0.8rem;
    color: var(--clr-error);
  }

  .welcome-input {
    flex: 1 1 8rem;
    min-width: 0;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: var(--clr-surface);
    color: var(--clr-text);
    font-size: 0.85rem;

    @include touch {
      min-height: $touch-target;
    }
  }

  .welcome-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(9rem, 100%), 1fr));
    gap: $spacing-sm;
  }

  .welcome-tile {
    padding: $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-md;
    background: var(--clr-surface-2);
    color: var(--clr-text);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;

    &.picked {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-on-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .welcome-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .welcome-move {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .welcome-skip {
    padding: $spacing-xs $spacing-sm;
    border: none;
    background: none;
    color: var(--clr-text-3);
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .welcome-btn {
    padding: $spacing-xs $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .welcome-btn-go {
    background: var(--clr-primary);
    border-color: transparent;
    color: var(--clr-on-primary);
  }
</style>
