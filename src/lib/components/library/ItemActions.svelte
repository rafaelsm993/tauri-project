<script lang="ts">
  import RemoveConfirm from "./RemoveConfirm.svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";
  import LogSessionDialog from "$lib/components/planner/LogSessionDialog.svelte";
  import PlanDialog from "$lib/components/planner/PlanDialog.svelte";
  import {
    DROP_ICON,
    LOG_ICON,
    PLAN_ICON,
    REMOVE_ICON,
    RESUME_ICON,
  } from "$lib/components/ui/icons";
  import { localDay } from "$lib/domain/calendar";
  import { resumeStatus } from "$lib/domain/status";
  import { libraryStore, type LibraryStore } from "$lib/stores/library.svelte";
  import type { LibraryEntry } from "$lib/types/library";
  import type { MediaDetail, MediaKey } from "$lib/types/media";

  // The detail page's actions for a saved item: plan, log, drop or resume, remove.
  let {
    entry,
    total,
    detail = null,
    dueMinutes = null,
    xpOf,
    library = libraryStore,
  }: {
    entry: LibraryEntry;
    total: number | null;
    detail?: MediaDetail | null;
    dueMinutes?: number | null;
    xpOf: (key: MediaKey) => number;
    library?: LibraryStore;
  } = $props();

  const id = $props.id();
  let open = $state<"plan" | "log" | "remove" | null>(null);
  const close = () => (open = null);

  const busy = $derived(library.isPending(entry.key));
  const dropped = $derived(entry.user.status === "dropped");
  const canLog = $derived(!!entry.user.plan && !dropped && entry.user.status !== "completed");
  const logHint = $derived(
    canLog ? "" : dropped ? "Resume it first" : entry.user.plan ? "It's finished" : "Plan it first",
  );

  function toggleDrop() {
    library.update(entry.key, { status: dropped ? resumeStatus(entry, total) : "dropped" });
  }

  function remove() {
    close();
    library.remove(entry.key);
  }
</script>

<div class="item-actions" role="toolbar" aria-label="Item actions">
  <button type="button" class="action" disabled={busy || dropped} onclick={() => (open = "plan")}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PLAN_ICON} /></svg>
    <span>{entry.user.plan ? "Edit plan" : "Plan"}</span>
  </button>
  <button
    type="button"
    class="action"
    disabled={busy || !canLog}
    aria-describedby={logHint ? `${id}-log` : undefined}
    onclick={() => (open = "log")}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={LOG_ICON} /></svg>
    <span>Log session</span>
  </button>
  {#if logHint}<span class="sr" id="{id}-log">{logHint}</span>{/if}
  <button type="button" class="action" disabled={busy} onclick={toggleDrop}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={dropped ? RESUME_ICON : DROP_ICON} /></svg>
    <span>{dropped ? "Resume" : "Drop"}</span>
  </button>
  <button
    type="button"
    class="action danger"
    disabled={busy}
    aria-haspopup="dialog"
    onclick={() => (open = "remove")}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={REMOVE_ICON} /></svg>
    <span>Remove</span>
  </button>
</div>

{#if open === "plan"}
  <PlanDialog {entry} detail={detail ?? undefined} today={localDay()} {library} onclose={close} />
{:else if open === "log"}
  <LogSessionDialog {entry} today={localDay()} {dueMinutes} {library} onclose={close} />
{:else if open === "remove"}
  <Sheet label="Remove {entry.snapshot.title}?" onclose={close}>
    <RemoveConfirm
      title={entry.snapshot.title}
      xp={xpOf(entry.key)}
      onremove={remove}
      onkeep={close}
    />
  </Sheet>
{/if}

<style lang="scss">
  .item-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: $spacing-xs;
  }

  .action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: $touch-target;
    padding: $spacing-xs 2px;
    border: none;
    border-radius: $radius-sm;
    background: none;
    color: var(--clr-text-2);
    font: inherit;
    font-size: 0.7rem;
    cursor: pointer;

    svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linejoin: round;
    }

    span {
      white-space: nowrap;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover:not(:disabled) {
        color: var(--clr-text);
        background: rgb(var(--clr-ink-rgb) / 0.06);
      }

      &.danger:hover:not(:disabled) {
        color: var(--clr-error);
      }
    }
  }

  .sr {
    @include sr-only;
  }
</style>
