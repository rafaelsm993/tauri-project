<script lang="ts">
  // Why a length matters when the catalog can't give it; colours follow the equipped accent.
  let {
    text,
    onadd = undefined,
    disabled = false,
  }: { text: string; onadd?: () => void; disabled?: boolean } = $props();
</script>

<div class="length-note" role="note">
  <p class="length-note-text">{text}</p>
  {#if onadd}
    <button type="button" class="length-note-btn" {disabled} onclick={onadd}>Add length</button>
  {/if}
</div>

<style lang="scss">
  .length-note {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border-inline-start: 3px solid var(--clr-accent);
    border-radius: $radius-md;
    background: rgb(var(--clr-accent-rgb) / 0.08);
  }

  .length-note-text {
    font-size: 0.85rem;
    color: var(--clr-text);
  }

  .length-note-btn {
    background: var(--clr-primary);
    color: var(--clr-on-primary);
    border: none;
    padding: $spacing-sm $spacing-lg;
    border-radius: $radius-full;
    font-size: 0.85rem;
    font-weight: 600;
    min-height: $touch-target;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--clr-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }
  }
</style>
