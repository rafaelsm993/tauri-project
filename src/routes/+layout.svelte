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
  import StartupProblem from "$lib/components/ui/StartupProblem.svelte";
  import { startupStatus } from "$lib/api/startup";
  import type { StartupProblem as Problem } from "$lib/types/startup";
  import { page } from "$app/state";
  import type { Snippet } from "svelte";
  import { forwardConsole, reportCspViolations } from "$lib/logging/console";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { prefsStore } from "$lib/stores/prefs.svelte";
  import { onReconnect } from "$lib/stores/online.svelte";
  import { checkNetwork, watchConnectivity, watchNetwork } from "$lib/api/offline";
  import { afterNavigate } from "$app/navigation";

  let { children }: { children: Snippet } = $props();

  // Side effect only (patches console.*), per the $effect rule in AGENTS.md.
  $effect(() => forwardConsole());
  $effect(() => reportCspViolations());

  // undefined while asking; a problem means the saved data was refused and nothing may load it.
  let problem = $state<Problem | null | undefined>(undefined);
  $effect(() => {
    startupStatus()
      .then((p) => (problem = p))
      .catch(() => (problem = null));
  });

  // The saved library and preferences are loaded once for the whole app.
  $effect(() => {
    if (problem !== null) return;
    libraryStore.hydrate();
    prefsStore.hydrate();
  });

  // The backend knows when a cached answer hid a failed request; the pill follows it.
  $effect(() => {
    const stop = watchNetwork();
    return () => void stop.then((unlisten) => unlisten());
  });

  // Screens without provider calls (library, settings) still learn when the network drops.
  afterNavigate(() => void checkNetwork());
  $effect(() => watchConnectivity(() => void checkNetwork()));

  // Posters that failed while offline download again as soon as the network returns.
  onReconnect(() => {
    if (problem === null) libraryStore.retryPosters();
  });
</script>

<AppBackground />
{#if problem}
  <div class="app-content">
    <StartupProblem {problem} />
  </div>
{:else}
  <div class="app-content">
    <header class="app-bar">
      <ProfileMenu current={page.url.pathname} />
    </header>
    {@render children()}
  </div>
  <OfflineBanner />
{/if}

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
