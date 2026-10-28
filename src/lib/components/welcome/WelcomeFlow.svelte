<script lang="ts">
  import WelcomeIllustration from "./WelcomeIllustration.svelte";
  import { beatAfter, beatBefore, isLastBeat, resumeBeat, type Beat } from "$lib/domain/welcome";
  import { keysStore, KeysStore } from "$lib/stores/keys.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import { beatIndex } from "$lib/domain/welcome";
  import type { Keyed } from "$lib/api/keys";
  import { untrack } from "svelte";

  let {
    prefs = prefsStore,
    keys = keysStore,
    ondone,
  }: { prefs?: PrefsStore; keys?: KeysStore; ondone: () => void } = $props();

  // Seeded once from the saved run; the flow owns them from here on.
  let beat = $state<Beat>(untrack(() => resumeBeat(prefs.prefs.welcome_beat)));
  let drafts = $state<Record<string, string>>({ tmdb: "", rawg: "" });

  let advancing = $state(false);
  const pending = $derived(advancing || keys.busy);
  const hasTmdb = $derived(keys.presence.tmdb || drafts.tmdb.trim().length > 0);
  const hasRawg = $derived(keys.presence.rawg || drafts.rawg.trim().length > 0);
  const keyContinue = $derived(
    hasTmdb && hasRawg
      ? "Continue"
      : hasTmdb
        ? "Continue without RAWG key"
        : hasRawg
          ? "Continue without TMDB key"
          : "Continue without keys",
  );

  const PROVIDERS: { which: Keyed; label: string; serves: string }[] = [
    { which: "tmdb", label: "TMDB key", serves: "Movies and TV shows" },
    { which: "rawg", label: "RAWG key", serves: "Games" },
  ];

  async function go(next: Beat) {
    beat = next;
    await prefs.update({ welcome_beat: beatIndex(next) });
  }

  async function finish() {
    await prefs.update({
      welcomed: true,
      welcome_beat: 0,
    });
    ondone();
  }

  async function saveKey(which: Keyed): Promise<boolean> {
    const saved = await keys.save(which, drafts[which]);
    if (saved) drafts = { ...drafts, [which]: "" };
    return saved;
  }

  async function forward() {
    if (pending) return;
    advancing = true;
    try {
      if (beat === "keys") {
        for (const provider of PROVIDERS) {
          if (drafts[provider.which].trim() && !(await saveKey(provider.which))) return;
        }
      }
      const next = beatAfter(beat);
      if (next === null) await finish();
      else await go(next);
    } finally {
      advancing = false;
    }
  }

  const back = $derived(beatBefore(beat));
</script>

<div class="welcome">
  <div class="welcome-beat">
    {#if beat === "garden"}
      <h1 class="welcome-title">Your library is a thing you grow</h1>
      <p class="welcome-text">
        Your Journey Tree grows across six media paths. Preview locked rewards there, then equip
        earned avatars, titles and themes in Settings. Current level and completions determine what
        stays unlocked.
      </p>
      <p class="welcome-text">
        This example shows the Books path. Your own tree reflects your library.
      </p>
    {:else if beat === "keys"}
      <h1 class="welcome-title">Bring your own keys</h1>
      <p class="welcome-text">
        Movies, TV and games come from providers that ask for a free key of your own. Books, anime
        and manga need nothing. You can add keys later in Settings. Keys are checked when you save
        or continue.
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
                disabled={pending}
                bind:value={drafts[provider.which]}
              />
              <button
                type="button"
                class="welcome-btn"
                disabled={pending || drafts[provider.which].trim().length === 0}
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
    {:else if beat === "planner"}
      <h1 class="welcome-title">Plan it when you are ready</h1>
      <p class="welcome-text">
        Save an item, then choose days and time per session in Plan. Tap days or drag to select
        several; start on a selected day to clear.
      </p>
      <p class="welcome-text">
        Planning schedules time. Log session records progress. The preview estimates your finish
        date.
      </p>
    {:else if beat === "pace"}
      <h1 class="welcome-title">Pages and chapters need different paces</h1>
      <p class="welcome-text">
        Books use pages per hour; manga uses minutes per chapter. A chapter is not a page.
      </p>
      <p class="welcome-text">
        Set defaults in Settings → Preferences. Plan can ask for missing lengths and pace;
        individual manga can keep their own chapter time.
      </p>
    {:else if beat === "manual"}
      <h1 class="welcome-title">Add anything, match it later</h1>
      <p class="welcome-text">
        Use Add manually when a search has no match. Add the required length to plan and track it.
      </p>
      <p class="welcome-text">
        Find a match previews a catalog item of the same media type. Catalog details replace manual
        details; tracking data is combined. Undo works only while the merged result remains
        unchanged. This is not backup import.
      </p>
    {/if}
    {#if beat !== "keys"}<WelcomeIllustration {beat} />{/if}
  </div>

  <div class="welcome-actions">
    <button type="button" class="welcome-skip" disabled={pending} onclick={finish}>Skip</button>
    <div class="welcome-move">
      {#if back !== null}
        <button type="button" class="welcome-btn" disabled={pending} onclick={() => go(back)}
          >Back</button
        >
      {/if}
      {#if beat === "keys"}
        <button
          aria-busy={pending}
          type="button"
          class="welcome-btn welcome-btn-go"
          disabled={pending}
          onclick={forward}
        >
          {pending ? "Checking keys…" : keyContinue}
        </button>
      {:else}
        <button
          type="button"
          class="welcome-btn welcome-btn-go"
          disabled={pending}
          onclick={forward}
        >
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
