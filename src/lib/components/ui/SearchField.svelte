<script lang="ts">
  // Instant filter input: reports every keystroke, never shows a loading state.
  let {
    label,
    value,
    placeholder = "",
    onchange,
  }: {
    label: string;
    value: string;
    placeholder?: string;
    onchange: (value: string) => void;
  } = $props();

  let input: HTMLInputElement | undefined = $state();

  function clear() {
    onchange("");
    input?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && value) {
      e.preventDefault();
      onchange("");
    }
  }
</script>

<div class="search-field">
  <svg class="search-field__icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="7"></circle>
    <line x1="20" y1="20" x2="16" y2="16"></line>
  </svg>
  <input
    bind:this={input}
    class="search-field__input"
    type="search"
    aria-label={label}
    {placeholder}
    {value}
    autocomplete="off"
    spellcheck="false"
    oninput={(e) => onchange(e.currentTarget.value)}
    {onkeydown}
  />
  {#if value}
    <button type="button" class="search-field__clear" aria-label="Clear search" onclick={clear}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18"></line>
        <line x1="18" y1="6" x2="6" y2="18"></line>
      </svg>
    </button>
  {/if}
</div>

<style lang="scss">
  .search-field {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 480px;
    min-width: 0;
  }

  .search-field__icon {
    position: absolute;
    inset-inline-start: $spacing-md;
    width: 18px;
    height: 18px;
    fill: none;
    stroke: var(--clr-text-3);
    stroke-width: 2.5;
    stroke-linecap: round;
    pointer-events: none;
  }

  .search-field__input {
    flex: 1;
    min-width: 0;
    min-height: $touch-target;
    padding-block: $spacing-xs;
    padding-inline: calc(#{$spacing-md} + 26px) calc(#{$touch-target} + #{$spacing-xs});
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    border-radius: $radius-full;
    color: var(--clr-text);
    font: inherit;
    font-size: 0.9rem;

    &::placeholder {
      color: var(--clr-text-3);
    }

    &::-webkit-search-cancel-button {
      appearance: none;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }
  }

  .search-field__clear {
    position: absolute;
    inset-inline-end: $spacing-xs;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: $radius-full;
    color: var(--clr-text-2);
    cursor: pointer;

    svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: -2px;
    }

    @include hover-capable {
      &:hover {
        color: var(--clr-text);
        background: rgb(var(--clr-ink-rgb) / 0.08);
      }
    }

    @include touch {
      width: $touch-target;
      height: $touch-target;
      inset-inline-end: 0;
    }
  }
</style>
