<script lang="ts">
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import type { Snippet } from "svelte";
  import { forwardConsole } from "$lib/logging/console";
  import { libraryStore } from "$lib/stores/library.svelte";

  let { children } = $props<{ children: Snippet }>();

  // Side effect only (patches console.*), per the $effect rule in AGENTS.md.
  $effect(() => forwardConsole());

  // The saved library is loaded once for the whole app.
  $effect(() => {
    libraryStore.hydrate();
  });
</script>

<AppBackground />
<div class="app-content">
  {@render children()}
</div>
