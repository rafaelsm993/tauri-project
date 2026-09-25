<script lang="ts">
  import { untrack } from "svelte";
  import { LENGTH_LABELS, REQUIRED_LENGTH_FIELDS, type LengthField } from "$lib/domain/length";
  import type { Length } from "$lib/types/library";
  import type { MediaType } from "$lib/types/media";

  let {
    mediaType,
    title,
    length,
    review,
    onsave,
    oncancel,
    busy = false,
  } = $props<{
    mediaType: MediaType;
    title: string;
    length: Length;
    review: string | null;
    onsave: (value: { length: Length; review: string | null }) => void;
    oncancel: () => void;
    busy?: boolean;
  }>();

  const id = $props.id();
  const fields = $derived(REQUIRED_LENGTH_FIELDS[mediaType as MediaType]);

  // A local copy, so typing never mutates the caller's prefill.
  let draft = $state<Length>(untrack(() => ({ ...length })));
  let note = $state(untrack(() => review ?? ""));

  function changeField(field: LengthField, event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value;
    const value = Number(raw);
    draft[field] = raw === "" || !Number.isFinite(value) || value < 0 ? null : Math.floor(value);
  }

  function save() {
    const text = note.trim();
    onsave({ length: { ...draft }, review: text === "" ? null : text });
  }

  function skip() {
    onsave({ length: { ...length }, review });
  }
</script>

<div class="add-sheet">
  <h2 class="sheet-title">Add {title}</h2>
  <p class="sheet-hint">Optional — used to plan how long this will take. You can add it later.</p>

  <div class="sheet-fields">
    {#each fields as field (field)}
      <div class="sheet-field">
        <label class="field-label" for="{id}-{field}">{LENGTH_LABELS[field]}</label>
        <input
          id="{id}-{field}"
          class="field-input"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          value={draft[field] ?? ""}
          disabled={busy}
          oninput={(event) => changeField(field, event)}
        />
      </div>
    {/each}

    <div class="sheet-field">
      <label class="field-label" for="{id}-review">Review</label>
      <textarea
        id="{id}-review"
        class="field-input review"
        rows="3"
        disabled={busy}
        bind:value={note}></textarea>
    </div>
  </div>

  <div class="sheet-actions">
    <button type="button" class="btn primary" disabled={busy} onclick={save}>Save</button>
    <button type="button" class="btn" disabled={busy} onclick={skip}>Skip</button>
    <button type="button" class="btn ghost" disabled={busy} onclick={oncancel}>Cancel</button>
  </div>
</div>

<style lang="scss">
  .add-sheet {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    width: min(28rem, 100%);
    padding: $spacing-lg;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }

  .sheet-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
    overflow-wrap: anywhere;
  }

  .sheet-hint {
    font-size: 0.8rem;
    color: var(--clr-text-3);
  }

  .sheet-fields {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
  }

  .sheet-field {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }

  .field-label {
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .field-input {
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
  }

  .review {
    resize: vertical;
  }

  .sheet-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .btn {
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.8rem;
    cursor: pointer;

    &.primary {
      background: var(--clr-primary);
      border-color: transparent;
      font-weight: 600;
    }

    &.ghost {
      color: var(--clr-text-2);
      border-color: transparent;
    }

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }

    @include hover-capable {
      &:hover:not(:disabled) {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
      padding-inline: $spacing-lg;
    }
  }

  .field-input {
    @include touch {
      min-height: $touch-target;
    }
  }
</style>
