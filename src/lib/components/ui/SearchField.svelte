<script lang="ts">
  import type { Snippet } from "svelte";
  // `instant` reports every keystroke (library filter); `submit` searches on Enter (home catalog).
  let {
    label,
    value,
    placeholder = "",
    mode = "instant",
    loading = false,
    onchange,
    onsubmit,
    onclear,
    trailing,
  }: {
    label: string;
    value: string;
    placeholder?: string;
    mode?: "instant" | "submit";
    loading?: boolean;
    onchange: (value: string) => void;
    onsubmit?: (query: string) => void;
    onclear?: () => void;
    trailing?: Snippet;
  } = $props();

  let input: HTMLInputElement | undefined = $state();
  let focused = $state(false);

  function empty() {
    onchange("");
    onclear?.();
  }

  function clear() {
    empty();
    input?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && value) {
      e.preventDefault();
      empty();
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const text = value.trim();
    if (text) onsubmit?.(text);
  }
</script>

{#snippet clearButton(className: string)}
  <button type="button" class={className} aria-label="Clear search" onclick={clear}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18"></line>
      <line x1="18" y1="6" x2="6" y2="18"></line>
    </svg>
  </button>
{/snippet}

{#if mode === "submit"}
  <form
    class="search-bar"
    class:has-trailing={!!trailing}
    class:focused
    class:loading
    role="search"
    aria-busy={loading}
    onsubmit={submit}
  >
    <div class="icon-wrap">
      {#if loading}
        <span class="spinner" role="status" aria-label="Searching"></span>
      {:else}
        <svg
          class="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      {/if}
    </div>
    <input
      bind:this={input}
      type="search"
      aria-label={label}
      {placeholder}
      {value}
      autocomplete="off"
      oninput={(e) => onchange(e.currentTarget.value)}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      {onkeydown}
    />
    {#if value}
      {@render clearButton("clear-btn")}
    {/if}
    {#if trailing}<div class="search-trailing">{@render trailing()}</div>{/if}
  </form>
{:else}
  <div class="search-field" class:has-trailing={!!trailing}>
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
      {@render clearButton("search-field__clear")}
    {/if}
    {#if trailing}<div class="search-trailing">{@render trailing()}</div>{/if}
  </div>
{/if}

<style lang="scss">
  .search-bar.has-trailing {
    padding-inline-end: $spacing-xs;
  }
  .search-trailing {
    display: grid;
    place-items: center;
    flex: 0 0 $touch-target;
    width: $touch-target;
    height: $touch-target;
  }
  .search-field > .search-trailing {
    position: absolute;
    inset-inline-end: 0;
  }
  .search-field.has-trailing .search-field__clear {
    inset-inline-end: $touch-target;
  }
  .search-field.has-trailing .search-field__input {
    padding-inline-end: calc(2 * #{$touch-target} + #{$spacing-xs});
  }
  /* ── Instant: the library filter ──────────────────────── */
  .search-field {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
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
    background: var(--clr-surface);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    border-radius: $radius-full;
    color: var(--clr-text);
    font: inherit;
    font-size: 0.9rem;

    &::placeholder {
      color: var(--clr-text-3);
    }

    &::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
      display: none;
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

  /* ── Submit: the home catalog bar ─────────────────────── */
  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: $bar-height;
    border-radius: $radius-full;
    padding: 0 $spacing-sm;
    /* Solid background — backdrop-filter unreliable across stacking contexts */
    background: rgb(var(--clr-surface-rgb) / 0.82);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.1);
    transition:
      border-color $dur-normal $ease-out-expo,
      box-shadow $dur-normal $ease-out-expo,
      background $dur-normal $ease-out-expo;

    &.focused {
      border-color: var(--clr-primary);
      box-shadow:
        0 0 0 3px rgb(var(--clr-primary-rgb) / 0.15),
        0 4px 24px rgb(var(--clr-shade-rgb) / 0.4);
      background: rgb(var(--clr-surface-rgb) / 0.95);
    }

    &.loading {
      border-color: var(--clr-teal);
    }

    input {
      flex: 1;
      min-width: 0;
      height: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: var(--clr-text);
      font-size: 0.95rem;
      font-family: $font-body;
      padding: 0 $spacing-xs;

      &::placeholder {
        color: var(--clr-text-3);
        transition: color $dur-normal ease;
      }

      &::-webkit-search-cancel-button {
        appearance: none;
      }
    }

    &.focused input::placeholder {
      color: rgb(var(--clr-ink-rgb) / 0.2);
    }
  }

  .icon-wrap {
    flex-shrink: 0;
    width: 44px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-icon {
    width: 20px;
    height: 20px;
    color: var(--clr-text-2);
    transition: color $dur-normal ease;

    .focused & {
      color: var(--clr-primary);
    }
  }

  .spinner {
    display: block;
    width: 20px;
    height: 20px;
    border: 2.5px solid rgb(var(--clr-primary-rgb) / 0.2);
    border-top-color: var(--clr-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .clear-btn {
    flex-shrink: 0;
    background: rgb(var(--clr-ink-rgb) / 0.08);
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: var(--clr-text-2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-left: $spacing-xs;
    transition:
      background $dur-fast ease,
      color $dur-fast ease;

    @include hover-capable {
      &:hover {
        background: rgb(var(--clr-ink-rgb) / 0.16);
        color: var(--clr-primary);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    @include touch {
      width: $touch-target;
      height: $touch-target;
    }

    svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 3;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
