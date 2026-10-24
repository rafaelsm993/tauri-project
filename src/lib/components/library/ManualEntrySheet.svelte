<script lang="ts">
  import ManualForm from "./ManualForm.svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import Toast from "$lib/components/ui/Toast.svelte";
  import { emptyLength } from "$lib/domain/length";
  import { libraryStore, LibraryStore } from "$lib/stores/library.svelte";
  import { manualEntry, ManualEntryStore } from "$lib/stores/manualEntry.svelte";
  import { motionStore } from "$lib/stores/motion.svelte";
  import type { LibraryEntry, ManualDraft, UserData } from "$lib/types/library";

  // The app's one add/edit sheet, mounted by the root layout; `entry` and `library` exist for tests.
  let {
    entry = manualEntry,
    library = libraryStore,
  }: { entry?: ManualEntryStore; library?: LibraryStore } = $props();

  let busy = $state(false);
  let error = $state("");

  const request = $derived(entry.current);
  const editing = $derived(request?.edit ? (library.get(request.edit) ?? null) : null);

  // An edit saves the details, then the length only when it changed; a new type moves the item.
  async function save(draft: ManualDraft, user: Partial<UserData>) {
    if (!request) return;
    busy = true;
    error = "";
    let saved: LibraryEntry | null = null;
    if (request.edit && editing && draft.media_type !== editing.snapshot.media_type) {
      saved = await library.retypeManual(request.edit, draft, user.length ?? emptyLength());
    } else if (request.edit) {
      const key = request.edit;
      const lengthChanged =
        !!user.length && JSON.stringify(user.length) !== JSON.stringify(editing?.user.length);
      const ok =
        (await library.editManual(key, draft)) &&
        (!lengthChanged || (await library.update(key, { length: user.length })));
      if (ok) saved = library.get(key) ?? null;
    } else {
      saved = await library.addManual(draft, user);
    }
    busy = false;
    if (saved) entry.saved(saved);
    else error = library.error || "Couldn't save this item.";
  }

  function close() {
    error = "";
    entry.close();
  }
</script>

{#if request}
  <Sheet
    label={editing ? `Edit ${editing.snapshot.title}` : "Add manually"}
    size="full"
    onclose={close}
    onclosed={() => entry.closed()}
  >
    <ManualForm
      type={request.type}
      title={request.title}
      edit={editing}
      entries={library.entries}
      {busy}
      {error}
      onsave={save}
      onopen={(found) => entry.openExisting(found)}
      oncancel={close}
    />
  </Sheet>
{/if}

<Toast
  open={!!entry.notice}
  label="Added"
  onclose={() => entry.dismissNotice()}
  autoHideMs={6000}
  resetKey={entry.notice?.key}
  motion={motionStore.on}
  closeLabel="Dismiss"
>
  <p class="notice">Added {entry.notice?.snapshot.title}</p>
  {#snippet actions()}
    <button type="button" class="notice-open" onclick={() => entry.openNotice()}>Open</button>
  {/snippet}
</Toast>

<style lang="scss">
  .notice {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 0.9rem;
  }

  .notice-open {
    min-height: 36px;
    padding: 0 $spacing-md;
    border: none;
    border-radius: $radius-sm;
    background: var(--clr-primary);
    color: var(--clr-on-primary);
    font-weight: 600;
    cursor: pointer;

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
