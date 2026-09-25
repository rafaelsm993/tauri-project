<script lang="ts">
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";

  // The store prop exists for tests; the app uses the singleton.
  let { store = prefsStore }: { store?: PrefsStore } = $props();

  type OnOff = "on" | "off";
  const ON_OFF: { value: OnOff; label: string }[] = [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
  ];
</script>

<main class="settings">
  <h1 class="settings-title">Settings</h1>

  <section class="settings-row">
    <div class="settings-text">
      <h2 class="settings-label">Animated background</h2>
      <p class="settings-hint">
        Moving shapes behind the app. It always pauses while the window is hidden or unfocused.
      </p>
    </div>
    <SegmentedControl
      label="Animated background"
      options={ON_OFF}
      value={store.prefs.background_animation ? "on" : "off"}
      disabled={!store.ready}
      onchange={(v) => store.update({ background_animation: v === "on" })}
    />
  </section>

  {#if store.error}
    <p class="settings-error" role="alert">{store.error}</p>
  {/if}
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

  .settings-error {
    color: var(--clr-error);
  }
</style>
