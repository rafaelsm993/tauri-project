<script lang="ts">
  import PlanSheet, { type PlanSave } from "$lib/components/library/PlanSheet.svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import { libraryStore, LibraryStore } from "$lib/stores/library.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import type { LibraryEntry } from "$lib/types/library";

  // Plans one item: asks what is missing, saves the pace, the length and the plan, then closes.
  let {
    entry,
    today,
    onclose,
    library = libraryStore,
    prefs = prefsStore,
  }: {
    entry: LibraryEntry;
    today: string;
    onclose: () => void;
    library?: LibraryStore;
    prefs?: PrefsStore;
  } = $props();

  const busy = $derived(library.isPending(entry.key));

  let failure = $state("");

  // A step that did not save stops the rest; the dialog stays open to retry.
  async function save({ plan, length, pagesPerHour }: PlanSave) {
    failure = "";
    if (
      pagesPerHour !== null &&
      !(await step(prefs, () => prefs.update({ reading_pages_per_hour: pagesPerHour })))
    )
      return;
    if (length && !(await step(library, () => library.update(entry.key, { length })))) return;
    if (await step(library, () => library.plan(entry.key, plan))) onclose();
  }

  async function clear() {
    failure = "";
    if (await step(library, () => library.plan(entry.key, null))) onclose();
  }

  async function step(store: { error: string }, run: () => Promise<boolean>): Promise<boolean> {
    const saved = await run();
    if (!saved) failure = store.error || "The change could not be saved.";
    return saved;
  }
</script>

<Sheet label="Plan {entry.snapshot.title}" {onclose}>
  <PlanSheet
    {entry}
    {today}
    pagesPerHour={prefs.prefs.reading_pages_per_hour}
    {busy}
    onsave={save}
    onclear={clear}
    oncancel={onclose}
  />
  {#if failure}
    <p class="plan-error" role="alert">⚠ {failure}</p>
  {/if}
</Sheet>

<style lang="scss">
  .plan-error {
    margin-top: $spacing-sm;
    color: var(--clr-error);
    font-size: 0.8rem;
  }
</style>
