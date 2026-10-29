<script lang="ts">
  import { tick, untrack, type Snippet } from "svelte";
  import { page } from "$app/state";
  let {
    title,
    anchors = [],
    initiallyOpen = false,
    children,
  }: {
    title: string;
    anchors?: string[];
    initiallyOpen?: boolean;
    children?: Snippet;
  } = $props();
  let details = $state<HTMLDetailsElement>();
  let open = $state(untrack(() => initiallyOpen));

  $effect(() => {
    const hash = page.url?.hash.slice(1) ?? "";
    if (!details || !anchors.includes(hash)) return;
    details.open = true;
    void tick().then(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
  });

  function toggled(event: Event) {
    const node = event.currentTarget as HTMLDetailsElement;
    open = node.open;
    if (node.open) return;
    node.querySelectorAll<HTMLElement>("[popover]").forEach((panel) => {
      if (panel.matches(":popover-open")) panel.hidePopover();
    });
  }
</script>

<details
  bind:open
  bind:this={details}
  class="settings-section"
  data-section={title}
  ontoggle={toggled}
>
  <summary>
    <h2>{title}</h2>
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
  </summary>
  <div class="section-body">
    {#if children}{@render children()}{/if}
  </div>
</details>

<style lang="scss">
  .settings-section {
    width: 100%;
    max-width: $settings-max-width;
    min-width: 0;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
    background: var(--clr-surface);
  }
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
    min-height: $touch-target;
    padding: $spacing-sm $spacing-md;
    cursor: pointer;
    list-style: none;
    &::-webkit-details-marker {
      display: none;
    }
    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: -2px;
    }
    h2 {
      font-size: 1rem;
      font-weight: 600;
    }
    svg {
      width: 1rem;
      height: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
    }
  }
  details[open] > summary svg {
    transform: rotate(180deg);
  }
  .section-body {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: 0 $spacing-md $spacing-md;
    min-width: 0;
  }
  .section-body :global(section[id]) {
    scroll-margin-top: 6rem;
  }
</style>
