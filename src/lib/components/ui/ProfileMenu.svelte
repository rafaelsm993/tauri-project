<script lang="ts">
  import { resolve } from "$app/paths";
  import { followTrigger } from "./popover";

  // `current` is the path you are on; the layout passes it so this stays testable.
  let { current }: { current: string } = $props();

  const id = $props.id();
  const panelId = `${id}-panel`;

  const LINKS = [
    { href: resolve("/profile"), label: "Profile" },
    { href: resolve("/library"), label: "Library" },
    { href: resolve("/settings"), label: "Settings" },
  ];

  let trigger = $state<HTMLButtonElement>();
  let panel = $state<HTMLDivElement>();
  let open = $state(false);

  function onToggle(e: ToggleEvent) {
    open = e.newState === "open";
  }

  // A SPA navigation does not close a popover by itself.
  function close() {
    panel?.hidePopover?.();
  }

  $effect(() => {
    if (!open || !trigger || !panel) return;
    return followTrigger(trigger, panel);
  });
</script>

<button
  bind:this={trigger}
  type="button"
  class="pm-trigger"
  aria-label="Profile menu"
  aria-expanded={open}
  popovertarget={panelId}
>
  <svg viewBox="0 0 24 24" aria-hidden="true" class="pm-icon">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
</button>

<div bind:this={panel} id={panelId} class="pm-panel" popover="auto" ontoggle={onToggle}>
  <nav aria-label="Profile" class="pm-nav">
    {#each LINKS as link (link.href)}
      <a
        class="pm-link"
        href={link.href}
        aria-current={current === link.href ? "page" : undefined}
        onclick={close}>{link.label}</a
      >
    {/each}
  </nav>
</div>

<style lang="scss">
  .pm-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    background: var(--clr-surface);
    color: var(--clr-text-2);
    cursor: pointer;
    transition:
      color $dur-fast ease,
      border-color $dur-fast ease;

    @include hover-capable {
      &:hover {
        color: var(--clr-text);
        border-color: var(--clr-primary);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 2px;
    }

    &[aria-expanded="true"] {
      color: var(--clr-text);
      border-color: var(--clr-primary);
    }

    @include touch {
      width: $touch-target;
      height: $touch-target;
    }
  }

  .pm-icon {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  // Top-layer panel; left/top/max-height come from followTrigger.
  .pm-panel {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    width: min(200px, calc(100vw - #{$spacing-md}));
    padding: $spacing-xs;
    overflow-y: auto;
    background: var(--clr-surface);
    color: var(--clr-text);
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-md;
    box-shadow: 0 12px 32px rgb(var(--clr-shade-rgb) / 0.5);
  }

  .pm-nav {
    display: flex;
    flex-direction: column;
  }

  .pm-link {
    display: flex;
    align-items: center;
    min-height: 36px;
    padding: 0 $spacing-sm;
    border-radius: $radius-sm;
    color: var(--clr-text-2);
    text-decoration: none;

    @include hover-capable {
      &:hover {
        color: var(--clr-text);
        background: rgb(var(--clr-ink-rgb) / 0.05);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: -2px;
      color: var(--clr-text);
    }

    &[aria-current="page"] {
      color: var(--clr-text);
      font-weight: 600;
    }

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
