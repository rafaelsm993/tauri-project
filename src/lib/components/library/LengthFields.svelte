<script lang="ts">
  import { LENGTH_LABELS, type LengthField } from "$lib/domain/length";
  import type { Length } from "$lib/types/library";

  // Edits `length` in place for each field listed; blanks and junk become null.
  let {
    fields,
    length = $bindable(),
    disabled = false,
  }: { fields: LengthField[]; length: Length; disabled?: boolean } = $props();

  const id = $props.id();

  function change(field: LengthField, event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value;
    const value = Number(raw);
    length[field] = raw === "" || !Number.isFinite(value) || value < 0 ? null : Math.floor(value);
  }
</script>

{#each fields as field (field)}
  <div class="length-field">
    <label class="length-label" for="{id}-{field}">{LENGTH_LABELS[field]}</label>
    <input
      id="{id}-{field}"
      class="length-input"
      type="number"
      min="0"
      step="1"
      inputmode="numeric"
      value={length[field] ?? ""}
      {disabled}
      oninput={(event) => change(field, event)}
    />
  </div>
{/each}

<style lang="scss">
  .length-field {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }

  .length-label {
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .length-input {
    width: 100%;
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    font-size: 0.85rem;
    font-family: inherit;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 1px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
