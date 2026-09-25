<script lang="ts">
  import "@fontsource/bebas-neue";
  import "@fontsource-variable/dm-sans/opsz.css";
  import "@fontsource-variable/dm-sans/opsz-italic.css";
  import "@fontsource/dm-mono/400.css";
  import "@fontsource/dm-mono/500.css";
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import OfflineBanner from "$lib/components/ui/OfflineBanner.svelte";
  import ProfileMenu from "$lib/components/ui/ProfileMenu.svelte";
  import { page } from "$app/state";
  import type { Snippet } from "svelte";
  import { forwardConsole, reportCspViolations } from "$lib/logging/console";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { prefsStore } from "$lib/stores/prefs.svelte";

  let { children } = $props<{ children: Snippet }>();

  // Side effect only (patches console.*), per the $effect rule in AGENTS.md.
  $effect(() => forwardConsole());
  $effect(() => reportCspViolations());

  // The saved library and preferences are loaded once for the whole app.
  $effect(() => {
    libraryStore.hydrate();
  });
  $effect(() => {
    prefsStore.hydrate();
  });
</script>

<AppBackground />
<div class="app-content">
  <header class="app-bar">
    <ProfileMenu current={page.url.pathname} />
  </header>
  {@render children()}
</div>
<OfflineBanner />

<style lang="scss">
  // Mirrors the home page box so the button lines up with the search bar and carousels.
  .app-bar {
    position: absolute;
    inset: 0 0 auto;
    z-index: var(--z-raised);
    display: flex;
    justify-content: flex-end;
    max-width: $page-max-width;
    margin-inline: auto;
    padding: $spacing-lg $spacing-xl 0;
    pointer-events: none;
  }
</style>
