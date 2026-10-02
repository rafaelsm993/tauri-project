<script lang="ts">
  import { motionStore } from "$lib/stores/motion.svelte";

  // A real on/off control: a button with role="switch", so Space and Enter work natively.
  let {
    label,
    hint,
    checked,
    disabled = false,
    motion,
    onchange,
  }: {
    label: string;
    hint?: string;
    checked: boolean;
    disabled?: boolean;
    motion?: boolean;
    onchange: (checked: boolean) => void;
  } = $props();

  const moves = $derived(motion ?? motionStore.on);

  const id = $props.id();
</script>

<div class="switch-row">
  <div class="switch-text">
    <span class="switch-label" id="{id}-label">{label}</span>
    {#if hint}
      <span class="switch-hint" id="{id}-hint">{hint}</span>
    {/if}
  </div>
  <button
    type="button"
    role="switch"
    class="switch"
    class:still={!moves}
    aria-checked={checked}
    aria-labelledby="{id}-label"
    aria-describedby={hint ? `${id}-hint` : undefined}
    {disabled}
    onclick={() => onchange(!checked)}
  >
    <span class="thumb"></span>
  </button>
</div>

<style lang="scss">
  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    min-width: 0;
  }

  .switch-text {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    flex: 1 1 auto;
    min-width: 0;
  }

  .switch-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .switch-hint {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }

  // The track is the hit area; on touch it grows to the 44 px target without changing its look.
  .switch {
    position: relative;
    flex: 0 0 auto;
    width: 48px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    background: var(--clr-surface-2);
    transition:
      background $dur-fast ease,
      border-color $dur-fast ease;

    &.still {
      transition: none;
    }

    &[aria-checked="true"] {
      background: var(--clr-primary);
      border-color: transparent;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 3px;
    }

    @include touch {
      &::before {
        content: "";
        position: absolute;
        inset: calc((#{$touch-target} - 28px) / -2) -2px;
      }
    }
  }

  .thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: $radius-full;
    background: var(--clr-on-primary);
    box-shadow: 0 1px 3px rgb(var(--clr-shade-rgb) / 0.4);
    transition: transform $dur-normal $ease-out-expo;

    [aria-checked="true"] > & {
      transform: translateX(20px);
    }

    .still > & {
      transition: none;
    }
  }
</style>
