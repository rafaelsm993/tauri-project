<script lang="ts">
  import AppHeader from "$lib/components/ui/AppHeader.svelte";
  import SettingsAccordion from "./SettingsAccordion.svelte";
  import ProfileArtworkSection from "./ProfileArtworkSection.svelte";
  import ThemeSection from "./ThemeSection.svelte";
  import TitlesSection from "./TitlesSection.svelte";
  import { unlocksStore } from "$lib/stores/unlocks.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import type { LibraryEntry } from "$lib/types/library";
  import Switch from "$lib/components/ui/Switch.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import BackupSection from "./BackupSection.svelte";
  import KeysSection from "./KeysSection.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";

  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  // The store prop exists for tests; the app uses the singleton.
  let {
    store = prefsStore,
    currentLevel = unlocksStore.level,
    currentEntries = libraryStore.ready ? libraryStore.entries : null,
  }: {
    store?: PrefsStore;
    currentLevel?: number | null;
    currentEntries?: LibraryEntry[] | null;
  } = $props();

  async function replayWelcome() {
    if (await store.update({ welcomed: false, welcome_beat: 0 })) await goto(resolve("/welcome"));
  }

  // How long one page or chapter takes; empty clears it, so planning asks again.
  type Pace = "reading_pages_per_hour" | "manga_chapter_minutes";
  const PACES: { field: Pace; label: string; min: number; max: number }[] = [
    { field: "reading_pages_per_hour", label: "Pages per hour (books)", min: 5, max: 300 },
    { field: "manga_chapter_minutes", label: "Minutes per chapter (manga)", min: 1, max: 120 },
  ];
  const id = $props.id();
  let paceError = $state<Partial<Record<Pace, string>>>({});

  function savePace({ field, min, max }: (typeof PACES)[number], event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value.trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && !(Number.isInteger(value) && value >= min && value <= max)) {
      paceError = { ...paceError, [field]: `Use ${min}-${max}.` };
      return;
    }
    paceError = { ...paceError, [field]: undefined };
    void store.update({ [field]: value });
  }
</script>

<main class="settings">
  <AppHeader heading="Settings" sticky={false} />
  {#if store.error}<ErrorNote message={store.error} />{/if}

  <SettingsAccordion title="Theme" anchors={["theme"]}>
    <ThemeSection prefs={store} {currentLevel} />
  </SettingsAccordion>

  <SettingsAccordion title="Profile" anchors={["profile-artwork", "titles"]}>
    <ProfileArtworkSection prefs={store} {currentLevel} entries={currentEntries} />
    <TitlesSection prefs={store} {currentLevel} />
  </SettingsAccordion>

  <SettingsAccordion title="Preferences">
    <section class="settings-row" aria-label="Animations">
      <Switch
        label="Animations"
        hint="Covers the background, the level-up burst and planner movement. Your system's reduce-motion setting always wins."
        checked={store.prefs.motion}
        disabled={!store.ready}
        onchange={(on) => store.update({ motion: on })}
      />
    </section>
    <section class="settings-row" aria-labelledby="{id}-pace">
      <div class="settings-text">
        <h3 class="settings-label" id="{id}-pace">Reading pace</h3>
        <p class="settings-hint">Used to plan books and manga. Left empty, planning asks for it.</p>
      </div>
      <div class="pace-fields">
        {#each PACES as pace (pace.field)}
          <div class="pace-field">
            <label class="pace-label" for="{id}-{pace.field}">{pace.label}</label>
            <input
              id="{id}-{pace.field}"
              class="pace-input"
              type="number"
              inputmode="numeric"
              min={pace.min}
              max={pace.max}
              step="1"
              value={store.prefs[pace.field] ?? ""}
              disabled={!store.ready}
              aria-invalid={!!paceError[pace.field]}
              aria-describedby={paceError[pace.field] ? `${id}-${pace.field}-error` : undefined}
              onchange={(event) => savePace(pace, event)}
            />
            {#if paceError[pace.field]}<span class="pace-error" id="{id}-{pace.field}-error"
                >{paceError[pace.field]}</span
              >{/if}
          </div>
        {/each}
      </div>
    </section>
    <KeysSection />
    <section class="settings-row">
      <div class="settings-text">
        <h3 class="settings-label">Welcome</h3>
        <p class="settings-hint">Walk through the first-run introduction again.</p>
      </div>
      <button type="button" class="settings-btn" disabled={!store.ready} onclick={replayWelcome}
        >Run the welcome again</button
      >
    </section>
  </SettingsAccordion>

  <SettingsAccordion title="Backup"><BackupSection /></SettingsAccordion>
</main>

<style lang="scss">
  .settings-btn {
    padding: $spacing-xs $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font-size: 0.85rem;
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

    @include hover-capable {
      &:hover:not(:disabled) {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .settings {
    @include page-shell;
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
  }

  .settings-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    padding: $spacing-sm 0;
    min-width: 0;

    > :global(.switch-row) {
      flex: 1 1 auto;
    }
  }

  .settings-text {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    flex: 1 1 16rem;
    min-width: 0;
  }

  .settings-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .settings-hint {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .pace-fields {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-md;
  }

  .pace-field {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .pace-label {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  .pace-input {
    width: 6rem;
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    font-size: 0.85rem;
    font-family: inherit;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 1px;
    }

    &[aria-invalid="true"] {
      border-color: var(--clr-error);
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .pace-error {
    font-size: 0.8rem;
    color: var(--clr-error);
  }
</style>
