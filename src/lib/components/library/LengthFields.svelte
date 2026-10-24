<script lang="ts">
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import { EPISODE_MINUTE_PRESETS, LENGTH_LABELS, type LengthField } from "$lib/domain/length";
  import type { Length } from "$lib/types/library";
  import type { MediaType } from "$lib/types/media";

  // Edits `length` in place for each field listed; blanks and junk become null.
  let {
    fields,
    length = $bindable(),
    mediaType,
    disabled = false,
    required = false,
  }: {
    fields: LengthField[];
    length: Length;
    mediaType: MediaType;
    disabled?: boolean;
    // The Plan sheet can't plan without these: tag them and outline the empty ones.
    required?: boolean;
  } = $props();

  const presets = $derived(
    (EPISODE_MINUTE_PRESETS[mediaType] ?? []).map((m) => ({ value: String(m), label: `${m} min` })),
  );

  const id = $props.id();

  function change(field: LengthField, event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value;
    const value = Number(raw);
    length[field] = raw === "" || !Number.isFinite(value) || value < 0 ? null : Math.floor(value);
  }
</script>

{#each fields as field (field)}
  <div class="length-field">
    <div class="length-head">
      <label class="length-label" for="{id}-{field}">{LENGTH_LABELS[field]}</label>
      {#if required}
        <span class="length-required" aria-hidden="true">Required</span>
      {/if}
    </div>
    <input
      id="{id}-{field}"
      class="length-input"
      type="number"
      min="0"
      step="1"
      inputmode="numeric"
      value={length[field] ?? ""}
      class:missing={required && !length[field]}
      aria-required={required || undefined}
      {disabled}
      oninput={(event) => change(field, event)}
    />
  </div>
{/each}

<!-- A wrapper the parent row can size: a side-by-side column is too narrow for the pills. -->
{#if fields.includes("episode_minutes") && presets.length}
  <div class="length-presets">
    <SegmentedControl
      label="Common episode lengths"
      options={presets}
      value={String(length.episode_minutes ?? "")}
      onchange={(m) => (length.episode_minutes = Number(m))}
      {disabled}
      fill
    />
  </div>
{/if}

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

  .length-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $spacing-xs;
  }

  .length-required {
    font-size: 0.68rem;
    padding: 0 $spacing-xs;
    border-radius: $radius-sm;
    background: rgb(var(--clr-accent-rgb) / 0.15);
    color: var(--clr-text);
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

    &.missing {
      border-color: var(--clr-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 1px;
    }

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
