<script lang="ts">
  import { unlocksStore, UnlocksStore, type Slot } from "$lib/stores/unlocks.svelte";
  import { ACCENTS, PACKS, offerable, type Palette } from "$lib/domain/themes";
  import type { Unlock } from "$lib/domain/unlocks";

  // The store prop exists for tests; the app uses the singleton.
  let { unlocks = unlocksStore }: { unlocks?: UnlocksStore } = $props();

  const theme = $derived(unlocks.baseTheme);

  // Only palettes that suit the current base theme are offerable, so a choice always applies.
  function choices(slot: Slot): Unlock[] {
    return unlocks.unlocked.filter((u) => {
      if (slot === "motif") return u.kind === "motif";
      if (slot === "garden") return u.kind === "garden";
      if (slot === "accent") return u.kind === "accent" && suits(ACCENTS[u.id]);
      return u.kind === "pack" && suits(PACKS[u.id]);
    });
  }

  const suits = (palette: Palette | undefined) =>
    palette !== undefined && offerable(palette, theme);

  const equipped = (slot: Slot) =>
    slot === "accent"
      ? unlocks.accent
      : slot === "pack"
        ? unlocks.pack
        : slot === "garden"
          ? unlocks.garden
          : unlocks.motif;

  const SLOTS: { slot: Slot; label: string }[] = [
    { slot: "accent", label: "Accent" },
    { slot: "pack", label: "Palette" },
    { slot: "motif", label: "Background" },
    { slot: "garden", label: "Garden" },
  ];
</script>

<section class="achievements" aria-labelledby="achievements-heading">
  <h2 id="achievements-heading">Achievements</h2>

  {#if unlocks.next}
    <p class="next">
      Next at level {unlocks.next.level}: <strong>{unlocks.next.label}</strong> — {unlocks.next
        .blurb}
    </p>
  {:else}
    <p class="next">Everything is unlocked. The whole wardrobe is yours.</p>
  {/if}

  {#each SLOTS as { slot, label } (slot)}
    {@const open = choices(slot)}
    {#if open.length > 0}
      <div class="slot">
        <h3>{label}</h3>
        <div class="row" role="group" aria-label={label}>
          <button
            type="button"
            class="chip"
            aria-pressed={equipped(slot) === "default"}
            onclick={() => unlocks.equip(slot, "default")}
          >
            Default
          </button>
          {#each open as item (item.id)}
            <button
              type="button"
              class="chip"
              aria-pressed={equipped(slot) === item.id}
              onclick={() => unlocks.equip(slot, item.id)}
            >
              {item.label}
            </button>
          {/each}
        </div>
        {#if slot === "motif"}
          <p class="note">Backgrounds draw only on the desktop app; phones keep the still glow.</p>
        {:else if slot === "garden"}
          <p class="note">The sway runs only on the desktop app; phones keep the garden still.</p>
        {/if}
      </div>
    {/if}
  {/each}

  {#if unlocks.locked.length > 0}
    <div class="slot">
      <h3>Still ahead</h3>
      <ul class="locked">
        {#each unlocks.locked as item (item.id)}
          <li>
            <span class="level">Level {item.level}</span>
            <span class="name">{item.label}</span>
            <span class="blurb">{item.blurb}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style lang="scss">
  .note {
    margin: $spacing-xs 0 0;
    font-size: 0.75rem;
    color: var(--clr-text-3);
  }

  .achievements {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
  }

  h3 {
    margin: 0 0 $spacing-xs;
    font-size: 0.875rem;
    color: var(--clr-text-2);
  }

  .next {
    margin: 0;
    color: var(--clr-text-2);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
  }

  // Selection is a filled background, not a tick box.
  .chip {
    min-width: 0;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.18);
    border-radius: $radius-full;
    background: transparent;
    color: var(--clr-text);
    cursor: pointer;

    &[aria-pressed="true"] {
      border-color: transparent;
      background: rgb(var(--clr-primary-rgb));
      color: var(--clr-on-primary);
    }

    @include hover-capable {
      &:hover {
        border-color: rgb(var(--clr-primary-rgb));
      }
    }

    @include touch {
      min-height: $touch-target;
      padding: $spacing-xs $spacing-md;
    }
  }

  .locked {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--clr-text-3);

    li {
      display: flex;
      flex-wrap: wrap;
      gap: $spacing-xs;
      align-items: baseline;
    }
  }

  .level {
    flex: 0 0 auto;
    padding: 0 $spacing-xs;
    border-radius: $radius-sm;
    background: rgb(var(--clr-ink-rgb) / 0.08);
    font-size: 0.75rem;
  }

  .name {
    color: var(--clr-text-2);
  }

  .blurb {
    flex: 1 1 100%;
    font-size: 0.875rem;
  }
</style>
