<script lang="ts">
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import Switch from "$lib/components/ui/Switch.svelte";
  import ErrorNote from "$lib/components/ui/ErrorNote.svelte";
  import BackupSection from "./BackupSection.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import type { Theme } from "$lib/types/prefs";

  // The store prop exists for tests; the app uses the singleton.
  let { store = prefsStore }: { store?: PrefsStore } = $props();

  const THEME_OPTIONS: { value: Theme; label: string }[] = [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ];
</script>

<main class="settings">
  <h1 class="settings-title">Settings</h1>

  <section class="settings-row" aria-label="Animations">
    <Switch
      label="Animations"
      hint="Covers the background, the level-up burst and planner movement. Your system's reduce-motion setting always wins."
      checked={store.prefs.motion}
      disabled={!store.ready}
      onchange={(on) => store.update({ motion: on })}
    />
  </section>

  <section class="settings-row">
    <div class="settings-text">
      <h2 class="settings-label">Theme</h2>
      <p class="settings-hint">System follows your device's light or dark setting.</p>
    </div>
    <SegmentedControl
      label="Theme"
      options={THEME_OPTIONS}
      value={store.prefs.theme}
      disabled={!store.ready}
      onchange={(theme) => store.update({ theme })}
    />
  </section>

  {#if store.error}
    <ErrorNote message={store.error} />
  {/if}

  <BackupSection />
</main>

<style lang="scss">
  .settings {
    @include page-shell;
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  .settings-title {
    @include page-title;
  }

  .settings-row {
    max-width: 48rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    padding: $spacing-md;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
    background: var(--clr-surface);
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
</style>
