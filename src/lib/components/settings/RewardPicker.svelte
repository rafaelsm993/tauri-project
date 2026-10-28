<script module lang="ts">
  export type PickerChoice = {
    value: string;
    label: string;
    hint: string;
    disabled: boolean;
  };
</script>

<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import { followTrigger } from "$lib/components/ui/popover";

  let {
    label,
    value,
    options,
    onchange,
    disabled = false,
    allowReselect = false,
    preview,
    imageOnly = false,
  }: {
    label: string;
    value: string;
    options: PickerChoice[];
    onchange: (value: string) => Promise<boolean>;
    disabled?: boolean;
    allowReselect?: boolean;
    imageOnly?: boolean;
    preview?: Snippet<[PickerChoice]>;
  } = $props();
  const id = $props.id();
  const chosen = $derived(options.find((option) => option.value === value) ?? options[0]);
  let trigger = $state<HTMLButtonElement>();
  let panel = $state<HTMLDivElement>();
  let open = $state(false);
  let pending = $state(false);

  $effect(() => {
    if (!open || !trigger || !panel) return;
    return followTrigger(trigger, panel, "start", true);
  });

  function togglePanel(event: MouseEvent) {
    event.preventDefault();
    if (!panel) return;
    if (panel.matches(":popover-open")) panel.hidePopover();
    else panel.showPopover();
    open = panel.matches(":popover-open");
  }

  async function toggled(event: ToggleEvent) {
    open = event.newState === "open";
    if (!open) return;
    await tick();
    panel?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')?.focus();
    if (!panel?.contains(document.activeElement)) {
      panel?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
  }

  function dismiss(restore = false) {
    if (open) panel?.hidePopover();
    if (restore) trigger?.focus({ preventScroll: true });
  }

  async function select(option: PickerChoice) {
    if (disabled || pending || option.disabled) return;
    if (option.value === value && !allowReselect) {
      dismiss(true);
      return;
    }
    pending = true;
    let saved: boolean;
    try {
      saved = await onchange(option.value);
    } finally {
      pending = false;
    }
    await tick();
    if (saved) dismiss(true);
    else
      panel
        ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')
        ?.focus();
  }

  function keydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    dismiss(true);
  }
</script>

<div
  class="reward-picker"
  class:image-only={imageOnly}
  role="group"
  aria-label={label}
  data-picker={label}
>
  <span class="field-label">{label}</span>
  <button
    bind:this={trigger}
    class="picker-trigger"
    type="button"
    aria-label="{label}: {chosen?.label ?? 'Unavailable'}"
    aria-expanded={open}
    aria-controls="{id}-choices"
    popovertarget="{id}-choices"
    onclick={togglePanel}
    onkeydown={keydown}
    disabled={disabled || pending}
  >
    {#if chosen && preview}<span class="preview" aria-hidden="true">{@render preview(chosen)}</span
      >{/if}
    <span class="current">{chosen?.label ?? "Unavailable"}</span>
    <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
  </button>
  <div
    bind:this={panel}
    id="{id}-choices"
    class="picker-panel"
    popover="auto"
    role="group"
    aria-label="{label} choices"
    onbeforetoggle={(event) => (open = event.newState === "open")}
    ontoggle={toggled}
  >
    {#each options as option (option.value)}
      <button
        type="button"
        class="picker-option"
        aria-label={option.label}
        aria-pressed={value === option.value}
        aria-describedby="{id}-{option.value}-hint"
        disabled={disabled || pending || option.disabled}
        onclick={() => select(option)}
        onkeydown={keydown}
      >
        {#if preview}<span class="preview" aria-hidden="true">{@render preview(option)}</span>{/if}
        <span class="option-copy"
          ><strong>{option.label}</strong><span id="{id}-{option.value}-hint">{option.hint}</span
          ></span
        >
      </button>
    {/each}
  </div>
</div>

<style lang="scss">
  .reward-picker {
    display: grid;
    grid-template-columns: minmax(5rem, 0.35fr) minmax(0, 1fr);
    align-items: center;
    gap: $spacing-sm;
    min-width: 0;
  }
  .field-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--clr-text-2);
  }
  .picker-trigger,
  .picker-option {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    min-width: 0;
    min-height: $touch-target;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: var(--clr-surface);
    color: var(--clr-text);
    text-align: left;
    font: inherit;
    cursor: pointer;
    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: -2px;
    }
    &:disabled {
      cursor: not-allowed;
    }
  }
  .picker-trigger {
    width: 100%;
  }
  .current {
    flex: 1;
    min-width: 0;
    font-size: 0.85rem;
    overflow-wrap: normal;
  }
  .chevron {
    width: 1rem;
    height: 1rem;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 2rem;
    flex: none;
    overflow: hidden;
  }
  .picker-panel {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    width: min(20rem, calc(100vw - 16px));
    padding: $spacing-xs;
    overflow-y: auto;
    overscroll-behavior: contain;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-md;
    background: var(--clr-surface);
    color: var(--clr-text);
    box-shadow: 0 8px 24px rgb(var(--clr-shade-rgb) / 0.35);
  }
  .picker-option {
    width: 100%;
    border-color: transparent;
    & + & {
      margin-top: $spacing-xs;
    }
    @include hover-capable {
      &:hover:not(:disabled) {
        border-color: var(--clr-accent);
      }
    }
    &[aria-pressed="true"] {
      background: var(--clr-primary);
      color: var(--clr-on-primary);
    }
    &[aria-pressed="true"]:focus-visible {
      outline-color: var(--clr-on-primary);
    }
  }
  .option-copy {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    strong {
      font-size: 0.85rem;
      font-weight: 600;
    }
    > span {
      font-size: 0.75rem;
    }
  }
  .image-only {
    .picker-panel:popover-open {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
      gap: $spacing-xs;
    }
    .picker-option {
      justify-content: center;
      min-width: $touch-target;
    }
    .picker-option + .picker-option {
      margin-top: 0;
    }
    .option-copy,
    .current {
      @include sr-only;
    }
    .picker-trigger {
      justify-content: space-between;
    }
  }
</style>
