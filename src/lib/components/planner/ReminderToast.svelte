<script lang="ts">
  import Toast from "$lib/components/ui/Toast.svelte";
  import { reminderText, type DueSession } from "$lib/domain/reminders";

  let {
    session,
    motion,
    onstart,
    onlater,
    onclose,
  }: {
    session: DueSession | null;
    motion: boolean;
    onstart: (session: DueSession) => void;
    onlater: () => void;
    onclose: () => void;
  } = $props();
</script>

<Toast
  open={!!session}
  label="Reminder"
  accent="--clr-hue-{session?.family ?? 'screen'}-rgb"
  bar
  {motion}
  closeLabel="Close reminder"
  {onclose}
>
  {#if session}
    <p class="reminder-text">{reminderText(session)}</p>
  {/if}
  {#snippet actions()}
    {#if session}
      <button type="button" class="reminder-btn primary" onclick={() => onstart(session)}>
        Start
      </button>
      <button type="button" class="reminder-btn" onclick={onlater}>Later</button>
    {/if}
  {/snippet}
</Toast>

<style lang="scss">
  .reminder-text {
    min-width: 0;
    flex: 1 1 12rem;
    overflow-wrap: anywhere;
  }

  .reminder-btn {
    min-height: 36px;
    padding: 0 $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: transparent;
    color: var(--clr-text);
    cursor: pointer;

    &.primary {
      background: var(--clr-primary);
      border-color: var(--clr-primary);
      color: var(--clr-on-primary);
    }

    @include hover-capable {
      &:hover {
        border-color: var(--clr-primary);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
