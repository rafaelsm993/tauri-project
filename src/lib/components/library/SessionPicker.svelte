<script lang="ts">
  import { tick } from "svelte";
  import {
    MAX_SESSION,
    choiceMinutes,
    nearestCount,
    sessionText,
    tooShortText,
    type SessionChoice,
    type SessionScale,
  } from "$lib/domain/sessionScale";
  import { formatMinutes } from "$lib/utils/format";

  // ‹ centre ›, with Custom typing minutes into the centre; the sheet owns `choice`.
  let {
    scale,
    choice = $bindable(),
    label,
    pagesPerHour,
    disabled = false,
  }: {
    scale: SessionScale;
    choice: SessionChoice;
    label: string;
    pagesPerHour: number;
    disabled?: boolean;
  } = $props();

  let input = $state<HTMLInputElement | null>(null);

  const minutes = $derived(choiceMinutes(scale, choice));
  const count = $derived(choice.custom ? nearestCount(scale, choice.typed) : minutes / scale.step);
  const text = $derived(sessionText(scale, minutes, pagesPerHour));
  const tooShort = $derived(choice.custom && Number.isFinite(minutes) && minutes < scale.min);
  const fewer = $derived(
    scale.kind === "units" ? `Fewer ${scale.noun}s` : `${formatMinutes(scale.step)} less`,
  );
  const more = $derived(
    scale.kind === "units" ? `More ${scale.noun}s` : `${formatMinutes(scale.step)} more`,
  );

  function go(n: number) {
    choice.count = n;
    choice.custom = false;
  }

  async function toggleCustom() {
    if (choice.custom) return go(count);
    choice.typed = minutes;
    choice.custom = true;
    await tick();
    input?.focus();
  }

  function read(event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value;
    choice.typed = raw === "" ? Number.NaN : Number(raw);
  }
</script>

<div class="stepper" role="group" aria-label={label}>
  <button
    type="button"
    class="step"
    aria-label={fewer}
    disabled={disabled || count <= 1}
    onclick={() => go(count - 1)}>‹</button
  >
  {#if choice.custom}
    <div class="step-value editing">
      <input
        bind:this={input}
        class="step-input"
        type="number"
        inputmode="numeric"
        aria-label="Minutes per session"
        min={scale.min}
        max={MAX_SESSION}
        step="1"
        value={Number.isFinite(choice.typed) ? choice.typed : ""}
        {disabled}
        oninput={read}
      />
      <span class="step-minutes">{tooShort ? tooShortText(scale) : text.detail}</span>
    </div>
  {:else if scale.full}
    <button
      type="button"
      class="step-value active"
      aria-pressed="true"
      {disabled}
      onclick={() => go(1)}
    >
      <span class="step-title">{text.title}</span>
      <span class="step-minutes">{text.detail}</span>
    </button>
  {:else}
    <div class="step-value active step-plain">
      <span class="step-title">{text.title}</span>
      {#if text.detail}<span class="step-minutes">{text.detail}</span>{/if}
    </div>
  {/if}
  <button
    type="button"
    class="step"
    aria-label={more}
    disabled={disabled || count >= scale.steps}
    onclick={() => go(count + 1)}>›</button
  >
  <button
    type="button"
    class="step-custom"
    class:active={choice.custom}
    aria-pressed={choice.custom}
    {disabled}
    onclick={toggleCustom}>Custom</button
  >
</div>

<style lang="scss">
  .stepper {
    display: grid;
    grid-template-columns: $touch-target 1fr $touch-target;
    align-items: center;
    gap: $spacing-xs $spacing-sm;
  }

  .step {
    width: $touch-target;
    height: $touch-target;
    border-radius: $radius-full;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    background: none;
    color: var(--clr-text);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover:not(:disabled) {
        border-color: var(--clr-accent);
      }
    }
  }

  .step-value {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: $touch-target;
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-lg;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    background: none;
    color: var(--clr-text-2);
    cursor: pointer;

    &.active {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-on-primary);

      .step-minutes {
        color: rgb(var(--clr-on-primary-rgb) / 0.75);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }
  }

  .step-title {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .step-minutes {
    font-size: 0.72rem;
    color: var(--clr-text-3);
  }

  // Discreet: plain underlined text until picked, then a small filled pill.
  .step-custom {
    grid-column: 3;
    justify-self: end;
    min-height: 32px;
    padding: 0 $spacing-sm;
    border: none;
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text-3);
    font-size: 0.75rem;
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
    cursor: pointer;

    &.active {
      background: var(--clr-primary);
      color: var(--clr-on-primary);
      text-decoration: none;
      font-weight: 600;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .step-value.editing {
    border-color: var(--clr-accent);
    cursor: text;
  }

  .step-input {
    width: 5rem;
    background: none;
    border: none;
    color: var(--clr-text);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;

    &:focus-visible {
      outline: none;
    }
  }

  .step-plain {
    cursor: default;
  }
</style>
