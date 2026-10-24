<script lang="ts">
  import { onMount, untrack } from "svelte";
  import PlanSheet, { type PlanSave } from "$lib/components/library/PlanSheet.svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import { catalog, type Catalog } from "$lib/api/catalog";
  import { catalogCanFill, lengthFromDetail } from "$lib/domain/length";
  import { detailPath } from "$lib/domain/libraryView";
  import { libraryStore, LibraryStore } from "$lib/stores/library.svelte";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import type { Length, LibraryEntry } from "$lib/types/library";
  import type { MediaDetail } from "$lib/types/media";

  // Plans one item: asks what is missing, saves the pace, the length and the plan, then closes.
  let {
    entry,
    today,
    onclose,
    library = libraryStore,
    prefs = prefsStore,
    // A detail the page already loaded, so the catalog is not asked twice.
    detail = undefined,
    catalogApi = catalog,
  }: {
    entry: LibraryEntry;
    today: string;
    onclose: () => void;
    library?: LibraryStore;
    prefs?: PrefsStore;
    detail?: MediaDetail;
    catalogApi?: Pick<Catalog, "fetchDetail">;
  } = $props();

  const busy = $derived(library.isPending(entry.key));
  const type = untrack(() => entry.snapshot.media_type);
  const asks = untrack(
    () => entry.snapshot.provider !== "manual" && catalogCanFill(type, entry.user.length),
  );

  let failure = $state("");
  // The sheet reads its length once, so a lookup must finish before it shows.
  let found = $state<Length | null>(
    untrack(() => (asks && detail ? lengthFromDetail(type, detail) : null)),
  );
  let ready = $state(untrack(() => !asks || detail !== undefined));

  onMount(async () => {
    if (ready) return;
    try {
      found = lengthFromDetail(type, await catalogApi.fetchDetail(type, detailPath(entry).id));
    } catch {
      // Offline or unknown to the catalog: the user types it, as before.
    }
    ready = true;
  });

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

<Sheet label="Plan {entry.snapshot.title}" focus="sheet" {onclose}>
  {#if ready}
    <PlanSheet
      {entry}
      {today}
      {found}
      pagesPerHour={prefs.prefs.reading_pages_per_hour}
      chapterMinutes={prefs.prefs.manga_chapter_minutes}
      {busy}
      onsave={save}
      onclear={clear}
      oncancel={onclose}
    />
  {:else}
    <p class="plan-wait" role="status">Looking up its length…</p>
  {/if}
  {#if failure}
    <p class="plan-error" role="alert">⚠ {failure}</p>
  {/if}
</Sheet>

<style lang="scss">
  .plan-wait {
    color: var(--clr-text-2);
    font-size: 0.85rem;
  }

  .plan-error {
    margin-top: $spacing-sm;
    color: var(--clr-error);
    font-size: 0.8rem;
  }
</style>
