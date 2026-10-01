<script lang="ts">
  import { resolve } from "$app/paths";
  import { detailPath } from "$lib/domain/libraryView";
  import { replannedText, type TodayPlan } from "$lib/domain/reminders";
  import { formatMinutes } from "$lib/utils/format";

  let {
    today,
    busy,
    ondone,
    onnext,
  }: {
    today: TodayPlan;
    busy: (key: string) => boolean;
    ondone: (key: string) => void;
    onnext: (key: string) => void;
  } = $props();

  const show = $derived(today.due.length > 0 || today.replanned !== null);
</script>

{#if show}
  <section class="today" aria-labelledby="today-heading">
    <h2 id="today-heading" class="today-heading">Today</h2>
    {#if today.due.length > 0}
      <ul class="chips">
        {#each today.due as d (d.entry.key)}
          {@const title = d.entry.snapshot.title}
          {@const path = detailPath(d.entry)}
          <li class="chip hue-{d.family}">
            <a
              class="chip-link"
              href={resolve("/media/[type]/[id]", {
                type: path.type,
                id: encodeURIComponent(path.id),
              })}
            >
              <span class="chip-title">{title}</span>
              <span class="chip-minutes">{formatMinutes(d.minutes)}</span>
            </a>
            <span class="chip-actions">
              <button
                type="button"
                class="chip-btn"
                aria-label="Done: {title}"
                disabled={busy(d.entry.key)}
                onclick={() => ondone(d.entry.key)}>Done</button
              >
              <button
                type="button"
                class="chip-btn"
                aria-label="Next session: {title}"
                disabled={busy(d.entry.key)}
                onclick={() => onnext(d.entry.key)}>Next session</button
              >
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="today-empty">Nothing else planned for today.</p>
    {/if}
    {#if today.replanned}
      <p class="today-note">{replannedText(today.replanned)}</p>
    {/if}
  </section>
{/if}

<style lang="scss">
  .today {
    display: flex;
    flex-direction: column;
    align-self: stretch;
    gap: $spacing-xs;
    min-width: 0;
    max-width: 100%;
  }

  .today-heading {
    font-family: $font-mono;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--clr-text-2);
  }

  .chips {
    display: flex;
    gap: $spacing-sm;
    overflow-x: auto;
    padding: 0 0 $spacing-xs;
    margin: 0;
    list-style: none;
    scrollbar-width: thin;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-shrink: 0;
    max-width: min(22rem, 85vw);
    padding: $spacing-xs $spacing-xs $spacing-xs $spacing-sm;
    border-radius: $radius-md;
    background: rgb(var(--hue) / 0.14);
    border-inline-start: 3px solid rgb(var(--hue));
  }

  .chip-link {
    display: flex;
    align-items: baseline;
    gap: $spacing-sm;
    min-width: 0;
    color: var(--clr-text);
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    @include touch {
      min-height: $touch-target;
      align-items: center;
    }
  }

  .chip-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-minutes {
    flex-shrink: 0;
    font-family: $font-mono;
    font-size: 0.75rem;
    color: var(--clr-text-2);
  }

  .chip-actions {
    display: flex;
    gap: $spacing-xs;
    flex-shrink: 0;
  }

  .chip-btn {
    min-height: 32px;
    padding: 0 $spacing-sm;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-sm;
    background: transparent;
    color: var(--clr-text-2);
    font-size: 0.8rem;
    white-space: nowrap;
    cursor: pointer;

    @include hover-capable {
      &:hover:not(:disabled) {
        color: var(--clr-text);
        border-color: rgb(var(--hue));
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

    @include touch {
      min-height: $touch-target;
    }
  }

  .today-empty,
  .today-note {
    font-size: 0.85rem;
    color: var(--clr-text-2);
  }
</style>
