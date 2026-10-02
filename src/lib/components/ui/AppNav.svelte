<script lang="ts">
  import { resolve } from "$app/paths";
  import LevelRing from "./LevelRing.svelte";
  import type { Section } from "$lib/domain/navigation";
  import type { LevelInfo } from "$lib/domain/gamification";

  // `section` is the tab you are in; `progress` is absent until the activity log has loaded.
  let {
    section,
    progress,
  }: { section: Section | null; progress?: { level: LevelInfo; title: string } } = $props();

  const ICONS: Record<Section, string> = {
    home: "M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z",
    library: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.8-1 2.7 15.5-3.8 1z",
    planner: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
    profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
    settings:
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3.3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.1z",
  };

  const TABS: { section: Section; path: "/" | `/${Exclude<Section, "home">}`; label: string }[] = [
    { section: "home", path: "/", label: "Home" },
    { section: "library", path: "/library", label: "Library" },
    { section: "planner", path: "/planner", label: "Planner" },
    { section: "profile", path: "/profile", label: "Profile" },
    { section: "settings", path: "/settings", label: "Settings" },
  ];

  const name = (tab: (typeof TABS)[number]) =>
    tab.section === "profile" && progress ? `Profile · Level ${progress.level.level}` : undefined;
</script>

<nav class="app-nav" aria-label="Main">
  <ul class="tabs">
    {#each TABS as tab (tab.section)}
      <li class="tab-item {tab.section}">
        <a
          class="tab"
          class:within={tab.section === "profile" && section === "settings"}
          href={resolve(tab.path)}
          aria-current={section === tab.section ? "page" : undefined}
          aria-label={name(tab)}
        >
          <span class="icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[tab.section]} /></svg>
            {#if tab.section === "profile" && progress}
              <LevelRing level={progress.level} />
            {/if}
          </span>
          <span class="label">{tab.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style lang="scss">
  // Desktop: a slim rail on the left, Settings pinned to its bottom.
  .app-nav {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: var(--z-nav);
    width: $nav-rail-width;
    padding: $spacing-lg 0 calc(#{$spacing-md} + env(safe-area-inset-bottom, 0px));
    border-right: 1px solid var(--clr-border);
    background: rgb(var(--clr-surface-rgb) / 0.92);
    backdrop-filter: blur(12px);

    @include respond-to(md) {
      inset: auto 0 0;
      width: auto;
      height: calc(#{$nav-bar-height} + env(safe-area-inset-bottom, 0px));
      padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
        env(safe-area-inset-left, 0px);
      border-right: none;
      border-top: 1px solid var(--clr-border);
    }
  }

  .tabs {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: $spacing-xs;
    height: 100%;
    padding-inline: $spacing-xs;

    @include respond-to(md) {
      flex-direction: row;
      gap: 0;
      padding-inline: 0;
    }
  }

  .tab-item.settings {
    margin-top: auto;

    @include respond-to(md) {
      display: none;
    }
  }

  .tab-item {
    @include respond-to(md) {
      flex: 1 1 0;
      min-width: 0;
    }
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 60px;
    padding: $spacing-xs 2px;
    border-radius: $radius-md;
    color: var(--clr-text-2);
    text-decoration: none;
    transition:
      color $dur-fast ease,
      background $dur-fast ease;

    @include respond-to(md) {
      height: $nav-bar-height;
      min-height: $touch-target;
      border-radius: 0;
    }

    @include hover-capable {
      &:hover {
        color: var(--clr-text);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: -2px;
    }
  }

  // The selected tab is a filled pill behind the icon (filled, never a tick).
  .icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 30px;
    border-radius: $radius-full;
    transition: background $dur-fast ease;

    svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    :global(.level-ring) {
      display: none;
      inset: -3px auto auto 50%;
      width: 34px;
      height: 34px;
      margin-left: -17px;

      @include respond-to(md) {
        display: block;
      }
    }
  }

  .tab[aria-current="page"] {
    color: var(--clr-text);

    .icon {
      background: rgb(var(--clr-primary-rgb) / 0.22);
    }
  }

  // Settings has no tab on phone; Profile, which links to it, stays lit there.
  .tab.within {
    @include respond-to(md) {
      color: var(--clr-text);

      .icon {
        background: rgb(var(--clr-primary-rgb) / 0.22);
      }
    }
  }

  .label {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
</style>
