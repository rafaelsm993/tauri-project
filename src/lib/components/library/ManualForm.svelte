<script lang="ts">
  import { untrack } from "svelte";
  import LengthFields from "./LengthFields.svelte";
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";
  import { emptyLength, REQUIRED_LENGTH_FIELDS } from "$lib/domain/length";
  import { CREATOR_LABEL, duplicateOf, splitTags } from "$lib/domain/manual";
  import { TYPE_ORDER } from "$lib/domain/libraryView";
  import { MEDIA_LABELS, type MediaType } from "$lib/types/media";
  import type { Length, LibraryEntry, ManualDraft, UserData } from "$lib/types/library";

  // Adds a hand-made item, or edits one (`edit`); the duplicate check runs against `entries`.
  let {
    type,
    title,
    edit = null,
    entries,
    busy = false,
    error = "",
    onsave,
    onopen,
    oncancel,
  }: {
    type: MediaType;
    title: string;
    edit?: LibraryEntry | null;
    entries: LibraryEntry[];
    busy?: boolean;
    error?: string;
    // When editing, `user` carries only the length; a new item also starts as Planning.
    onsave: (draft: ManualDraft, user: Partial<UserData>) => void;
    onopen: (entry: LibraryEntry) => void;
    oncancel: () => void;
  } = $props();

  const id = $props.id();
  const start = untrack(() => edit?.snapshot);

  let mediaType = $state<MediaType>(untrack(() => start?.media_type ?? type));
  let name = $state(untrack(() => start?.title ?? title));
  let year = $state(start?.year ?? "");
  let creator = $state(start?.creator ?? "");
  let genres = $state((start?.genres ?? []).join(", "));
  let platforms = $state((start?.platforms ?? []).join(", "));
  let overview = $state(start?.overview ?? "");
  let length = $state<Length>(untrack(() => (edit ? { ...edit.user.length } : emptyLength())));
  let tried = $state(false);
  let lookalike = $state<LibraryEntry | null>(null);

  const typeOptions = TYPE_ORDER.map((t) => ({ value: t, label: MEDIA_LABELS[t] }));
  const genreChips = $derived(splitTags(genres));
  const isGame = $derived(mediaType === "game");
  const retyping = $derived(!!edit && mediaType !== edit.snapshot.media_type);
  const titleError = $derived(tried && !name.trim() ? "Add a title." : "");
  const yearError = $derived(
    tried && year.trim() && !/^[12]\d{3}$/.test(year.trim()) ? "Use four digits, like 1999." : "",
  );

  const draft = (): ManualDraft => ({
    media_type: mediaType,
    title: name.trim(),
    year: year.trim() || null,
    creator: creator.trim() || null,
    overview: overview.trim() || null,
    genres: genreChips,
    platforms: isGame ? splitTags(platforms) : [],
  });

  function send() {
    lookalike = null;
    onsave(
      draft(),
      edit ? { length: { ...length } } : { status: "planning", length: { ...length } },
    );
  }

  function save() {
    tried = true;
    if (titleError || yearError) return;
    const twin = duplicateOf(entries, draft(), edit?.key);
    if (twin) lookalike = twin;
    else send();
  }

  // A changed field makes the old warning stale.
  function changed() {
    lookalike = null;
  }

  // The warning lands under the pinned Save bar on a phone, so bring it into view.
  const reveal = (node: HTMLElement) => node.scrollIntoView?.({ block: "nearest" });
</script>

<form
  class="manual-form"
  novalidate
  oninput={changed}
  onsubmit={(event) => {
    event.preventDefault();
    save();
  }}
>
  <div class="form-head">
    <h2 class="form-title">{edit ? `Edit ${edit.snapshot.title}` : "Add manually"}</h2>
    <button type="button" class="close" aria-label="Close" disabled={busy} onclick={oncancel}>
      <span aria-hidden="true">✕</span>
    </button>
  </div>

  <div class="form-fields">
    <div class="field">
      <span class="field-label" id="{id}-type">Type</span>
      <SegmentedControl
        label="Type"
        options={typeOptions}
        value={mediaType}
        disabled={busy}
        onchange={(t) => {
          mediaType = t;
          // Each type counts its length differently; its own saved length comes back with it.
          if (edit)
            length = t === edit.snapshot.media_type ? { ...edit.user.length } : emptyLength();
          changed();
        }}
      />
      {#if retyping}
        <p class="retype-note" role="note">
          Changing the type to {MEDIA_LABELS[mediaType]} starts its progress over at 0 and removes its
          plan, because each type counts progress differently. Enter its length again below. Its history
          and XP stay with it.
        </p>
      {/if}
    </div>

    <div class="field">
      <label class="field-label" for="{id}-title">Title</label>
      <input
        id="{id}-title"
        class="field-input"
        autocomplete="off"
        maxlength="200"
        disabled={busy}
        aria-invalid={!!titleError}
        aria-describedby={titleError ? `${id}-title-error` : undefined}
        bind:value={name}
      />
      {#if titleError}
        <p class="field-error" id="{id}-title-error">{titleError}</p>
      {/if}
    </div>

    <div class="field-row">
      <div class="field year">
        <label class="field-label" for="{id}-year">Year</label>
        <input
          id="{id}-year"
          class="field-input"
          inputmode="numeric"
          maxlength="4"
          autocomplete="off"
          disabled={busy}
          aria-invalid={!!yearError}
          aria-describedby={yearError ? `${id}-year-error` : undefined}
          bind:value={year}
        />
        {#if yearError}
          <p class="field-error" id="{id}-year-error">{yearError}</p>
        {/if}
      </div>
      <div class="field grow">
        <label class="field-label" for="{id}-creator">{CREATOR_LABEL[mediaType]}</label>
        <input
          id="{id}-creator"
          class="field-input"
          maxlength="200"
          disabled={busy}
          bind:value={creator}
        />
      </div>
    </div>

    <div class="field">
      <label class="field-label" for="{id}-genres">Genres <span>(comma-separated)</span></label>
      <input id="{id}-genres" class="field-input" disabled={busy} bind:value={genres} />
      {#if genreChips.length > 0}
        <ul class="chips" aria-label="Genre preview">
          {#each genreChips as chip (chip)}
            <li class="chip">{chip}</li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if isGame}
      <div class="field">
        <label class="field-label" for="{id}-platforms">
          Platforms <span>(comma-separated)</span>
        </label>
        <input id="{id}-platforms" class="field-input" disabled={busy} bind:value={platforms} />
      </div>
    {/if}

    <div class="field">
      <label class="field-label" for="{id}-overview">Description</label>
      <textarea
        id="{id}-overview"
        class="field-input overview"
        rows="3"
        maxlength="2000"
        disabled={busy}
        bind:value={overview}></textarea>
    </div>

    <div class="field-row">
      <LengthFields
        fields={REQUIRED_LENGTH_FIELDS[mediaType]}
        bind:length
        {mediaType}
        disabled={busy}
      />
    </div>
  </div>

  {#if lookalike}
    <div class="lookalike" role="alert" {@attach reveal}>
      <p>{lookalike.snapshot.title} is already in your library.</p>
      <div class="lookalike-actions">
        <button type="button" class="btn" disabled={busy} onclick={send}>Save anyway</button>
        <button type="button" class="btn" disabled={busy} onclick={() => onopen(lookalike!)}>
          Open it
        </button>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="form-error">⚠ {error}</p>
  {/if}

  <div class="form-actions">
    <button type="submit" class="btn primary" disabled={busy} aria-busy={busy}>Save</button>
    <button type="button" class="btn ghost" disabled={busy} onclick={oncancel}>Cancel</button>
  </div>
</form>

<style lang="scss">
  .retype-note {
    font-size: 0.85rem;
    color: var(--clr-text-2);
    border-inline-start: 3px solid var(--clr-accent);
    padding-inline-start: $spacing-sm;
  }

  .manual-form {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-height: 100%;
    padding: $spacing-lg;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }

  .form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
  }

  .form-title {
    min-width: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
    overflow-wrap: anywhere;
  }

  .close {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: $radius-full;
    background: rgb(var(--clr-ink-rgb) / 0.08);
    color: var(--clr-text);
    font-size: 1rem;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover {
        background: rgb(var(--clr-ink-rgb) / 0.16);
      }
    }

    @include touch {
      width: $touch-target;
      height: $touch-target;
    }
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    min-width: 0;
  }

  .field-row {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-md;

    > :global(*) {
      flex: 1 1 8rem;
    }

    // The typical episode lengths get a row of their own under both fields.
    > :global(.length-presets) {
      flex-basis: 100%;
    }
  }

  .year {
    flex: 0 1 6rem;
  }

  .grow {
    flex: 1 1 12rem;
  }

  .field-label {
    font-size: 0.78rem;
    color: var(--clr-text-2);
    font-family: $font-mono;
    letter-spacing: 0.04em;

    span {
      color: var(--clr-text-3);
    }
  }

  .field-input {
    width: 100%;
    background: rgb(var(--clr-ink-rgb) / 0.06);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    font-size: 0.9rem;
    font-family: inherit;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 1px;
    }

    &[aria-invalid="true"] {
      border-color: var(--clr-error);
    }

    @include touch {
      min-height: $touch-target;
      // At 16 px and up the phone keyboard doesn't zoom the page.
      font-size: 1rem;
    }
  }

  .overview {
    resize: vertical;
  }

  .field-error,
  .form-error {
    color: var(--clr-error);
    font-size: 0.78rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .chip {
    padding: 2px $spacing-sm;
    border-radius: $radius-full;
    background: rgb(var(--clr-ink-rgb) / 0.08);
    font-size: 0.75rem;
    color: var(--clr-text-2);
    overflow-wrap: anywhere;
  }

  .lookalike {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border-inline-start: 3px solid rgb(var(--clr-highlight-rgb));
    background: rgb(var(--clr-highlight-rgb) / 0.08);
    // Clears the pinned Save bar when scrolled into view.
    scroll-margin-bottom: calc(#{$touch-target} + 2 * #{$spacing-md});
    border-radius: $radius-sm;
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }

  .lookalike-actions {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  // Stays reachable at the bottom of a long form, above the keyboard.
  .form-actions {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    margin-top: auto;
    padding-block: $spacing-sm;
    background: var(--clr-surface);
  }

  .btn {
    background: none;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.12);
    color: var(--clr-text);
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.85rem;
    cursor: pointer;

    &.primary {
      background: var(--clr-primary);
      border-color: transparent;
      color: var(--clr-on-primary);
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
</style>
