<script lang="ts">
  import LibraryCard from "./LibraryCard.svelte";
  import LogSessionDialog from "$lib/components/planner/LogSessionDialog.svelte";
  import PlanDialog from "$lib/components/planner/PlanDialog.svelte";
  import { localDay } from "$lib/domain/calendar";
  import { libraryStore, type LibraryStore } from "$lib/stores/library.svelte";
  import type { LibraryEntry } from "$lib/types/library";

  // A library card that can be planned and logged from where it sits (Library, Continue).
  // `library` is a prop only so tests can hand in their own store.
  let {
    entry,
    posterDir,
    dueMinutes = null,
    library = libraryStore,
  }: {
    entry: LibraryEntry;
    posterDir: string | null;
    dueMinutes?: number | null;
    library?: LibraryStore;
  } = $props();

  let open = $state<"plan" | "log" | null>(null);
  const close = () => (open = null);
</script>

<LibraryCard
  {entry}
  {posterDir}
  {dueMinutes}
  onplan={() => (open = "plan")}
  onlog={() => (open = "log")}
/>
{#if open === "plan"}
  <PlanDialog {entry} today={localDay()} {library} onclose={close} />
{:else if open === "log"}
  <LogSessionDialog {entry} today={localDay()} {dueMinutes} {library} onclose={close} />
{/if}
