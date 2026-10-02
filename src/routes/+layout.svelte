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
  import LevelUpToast from "$lib/components/ui/LevelUpToast.svelte";
  import ReminderToast from "$lib/components/planner/ReminderToast.svelte";
  import StartupProblem from "$lib/components/ui/StartupProblem.svelte";
  import { startupStatus } from "$lib/api/startup";
  import type { StartupProblem as Problem } from "$lib/types/startup";
  import { page } from "$app/state";
  import { untrack, type Snippet } from "svelte";
  import { forwardConsole, reportCspViolations } from "$lib/logging/console";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { prefsStore } from "$lib/stores/prefs.svelte";
  import { gamificationStore } from "$lib/stores/gamification.svelte";
  import { onReconnect } from "$lib/stores/online.svelte";
  import { checkNetwork, watchConnectivity, watchNetwork } from "$lib/api/offline";
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { MediaQuery } from "svelte/reactivity";
  import { reminderStore } from "$lib/stores/reminders.svelte";
  import { detailPath } from "$lib/domain/libraryView";
  import { inAppHistory } from "$lib/utils/history";
  import type { DueSession } from "$lib/domain/reminders";

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

  // Loaded once for the whole app; the level needs both, and a failed library undercounts it.
  $effect(() => {
    if (problem !== null) return;
    untrack(() => {
      void Promise.all([libraryStore.hydrate(), prefsStore.hydrate()]).then(() => {
        if (libraryStore.ready) void gamificationStore.load().then(() => reminderStore.check());
      });
    });
  });

  const progress = $derived(
    gamificationStore.ready
      ? { level: gamificationStore.level, title: gamificationStore.title.name }
      : undefined,
  );

  // The backend knows when a cached answer hid a failed request; the pill follows it.
  $effect(() => {
    const stop = watchNetwork();
    return () => void stop.then((unlisten) => unlisten());
  });

  // Back needs to know whether an in-app page is behind; screens without provider calls
  // (library, settings) still learn when the network drops.
  afterNavigate((navigation) => {
    inAppHistory.note(navigation);
    void checkNetwork();
  });
  $effect(() => watchConnectivity(() => void checkNetwork()));

  // Reminders are checked only when the app is in front: on launch, focus and return.
  $effect(() => {
    const check = () => {
      if (document.visibilityState === "visible") reminderStore.check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  });

  const reduced = new MediaQuery("prefers-reduced-motion: reduce");
  const motion = $derived(prefsStore.prefs.background_animation && !reduced.current);

  function start(session: DueSession) {
    reminderStore.dismiss();
    const path = detailPath(session.entry);
    void goto(resolve("/media/[type]/[id]", { type: path.type, id: encodeURIComponent(path.id) }));
  }

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
      <ProfileMenu current={page.url.pathname} {progress} />
    </header>
    {@render children()}
  </div>
  <OfflineBanner />
  <LevelUpToast moment={gamificationStore.moment} onclose={() => gamificationStore.dismiss()} />
  <ReminderToast
    session={reminderStore.visibleToast}
    {motion}
    onstart={start}
    onlater={() => reminderStore.later()}
    onclose={() => reminderStore.dismiss()}
  />
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
