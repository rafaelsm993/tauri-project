<script lang="ts">
  // Popover gives top-layer rendering, light-dismiss and Esc; the panel is clamped to the viewport.
  import { followTrigger } from "./popover";

  type Value = string | number;
  type Option = { value: Value; label: string };

  let {
    label,
    options = [],
    selected = [],
    onchange,
    disabled = false,
  }: {
    label: string;
    options: Option[];
    selected: Value[];
    onchange: (next: Value[]) => void;
    disabled?: boolean;
  } = $props();

  const id = $props.id();
  const panelId = `${id}-panel`;

  let trigger = $state<HTMLButtonElement>();
  let panel = $state<HTMLDivElement>();
  let open = $state(false);

  const count = $derived(selected.length);

  function toggleValue(value: Value, checked: boolean) {
    const isOn = (v: Value) => (v === value ? checked : selected.includes(v));
    onchange(options.map((o: Option) => o.value).filter(isOn));
  }

  function onToggle(e: ToggleEvent) {
    open = e.newState === "open";
  }

  // Keep the panel attached to the trigger while open (scroll / resize).
  $effect(() => {
    if (!open || !trigger || !panel) return;
    return followTrigger(trigger, panel);
  });
</script>

<button
  bind:this={trigger}
  type="button"
  class="ms-trigger"
  class:has-value={count > 0}
  popovertarget={panelId}
  aria-expanded={open}
  {disabled}
>
  <span class="ms-trigger__label">{count > 0 ? `${label} · ${count}` : label}</span>
  <svg class="ms-trigger__chevron" class:open viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
</button>

<div bind:this={panel} id={panelId} class="ms-panel" popover="auto" ontoggle={onToggle}>
  <fieldset class="ms-group">
    <legend class="ms-legend">{label}</legend>
    {#each options as o (o.value)}
      <label class="ms-option">
        <input
          type="checkbox"
          checked={selected.includes(o.value)}
          onchange={(e) => toggleValue(o.value, e.currentTarget.checked)}
        />
        <span>{o.label}</span>
      </label>
    {/each}
  </fieldset>
  {#if count > 0}
    <button type="button" class="ms-clear" onclick={() => onchange([])}>Clear</button>
  {/if}
</div>

<style lang="scss">
  // Trigger matches a CategoryTabs tab so it reads as part of the bar.
  .ms-trigger {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    padding: $spacing-xs $spacing-md;
    border: none;
    border-radius: $radius-full;
    background: transparent;
    color: var(--clr-text-3);
    font-size: 0.76rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    white-space: nowrap;
    cursor: pointer;
    transition:
      color $dur-fast ease,
      background $dur-fast ease;

    @include hover-capable {
      &:hover:not(:disabled) {
        color: var(--clr-text);
        background: rgb(var(--clr-ink-rgb) / 0.05);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }

    &.has-value {
      color: var(--clr-text);
      font-weight: 700;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .ms-trigger__chevron {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform $dur-fast ease;

    &.open {
      transform: rotate(180deg);
    }
  }

  // Top-layer panel; left/top/max-height are set from the trigger on open.
  .ms-panel {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    width: min(260px, calc(100vw - #{$spacing-md}));
    padding: $spacing-xs;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--clr-surface);
    color: var(--clr-text);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.08);
    border-radius: $radius-md;
    box-shadow: 0 12px 32px rgb(var(--clr-shade-rgb) / 0.5);
  }

  .ms-group {
    margin: 0;
    padding: 0;
    border: none;
    display: flex;
    flex-direction: column;
  }

  .ms-legend {
    @include sr-only;
  }

  // The native checkbox stays (keyboard, screen readers, real click target) but is
  // transparent and stretched over the row; a selected row gets a filled
  // background, like an active category tab.
  .ms-option {
    position: relative;
    display: flex;
    align-items: center;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-sm;
    color: var(--clr-text-2);
    font-size: 0.84rem;
    cursor: pointer;
    transition:
      background $dur-fast ease,
      color $dur-fast ease;

    & + & {
      margin-top: 2px;
    }

    input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }

    &:has(input:focus-visible) {
      outline: 2px solid var(--clr-primary);
      outline-offset: -2px;
    }

    @include hover-capable {
      &:hover {
        background: rgb(var(--clr-ink-rgb) / 0.05);
        color: var(--clr-text);
      }
    }

    // After :hover so a selected row keeps its fill under the pointer.
    &:has(input:checked) {
      background: var(--clr-primary);
      color: var(--clr-text);
      font-weight: 600;
    }

    &:has(input:checked:focus-visible) {
      outline-color: var(--clr-text);
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .ms-clear {
    position: sticky;
    bottom: 0;
    width: 100%;
    margin-top: $spacing-xs;
    padding: $spacing-sm;
    border: none;
    border-top: 1px solid rgb(var(--clr-ink-rgb) / 0.08);
    background: var(--clr-surface);
    color: var(--clr-text-2);
    font-size: 0.78rem;
    cursor: pointer;

    @include hover-capable {
      &:hover {
        color: var(--clr-text);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: -2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
