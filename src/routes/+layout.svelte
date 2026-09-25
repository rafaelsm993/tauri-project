<script lang="ts">
  import "@fontsource/bebas-neue";
  import "@fontsource-variable/dm-sans/opsz.css";
  import "@fontsource-variable/dm-sans/opsz-italic.css";
  import "@fontsource/dm-mono/400.css";
  import "@fontsource/dm-mono/500.css";
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
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

<style lang="scss">
  // Its own row, so it can never cover a page's search bar or back button.
  .app-bar {
    display: flex;
    justify-content: flex-end;
    padding: $spacing-sm clamp(#{$spacing-md}, 4vw, #{$spacing-2xl}) 0;
  }
</style>
