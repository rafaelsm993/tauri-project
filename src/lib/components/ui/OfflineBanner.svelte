<script lang="ts">
  import { onlineStore, type OnlineStore } from "$lib/stores/online.svelte";

  let { store = onlineStore }: { store?: OnlineStore } = $props();
</script>

<div class="offline" role="status">
  {#if !store.online}
    <p class="offline__pill">
      <span class="offline__dot" aria-hidden="true"></span>
      <span>Offline</span>
      <span class="offline__detail">— your library still works</span>
    </p>
  {/if}
</div>

<style lang="scss">
  // Bottom-left so it never meets the bottom-right back-to-top button.
  .offline {
    position: fixed;
    left: calc(#{$spacing-md} + env(safe-area-inset-left, 0px));
    bottom: calc(#{$spacing-lg} + env(safe-area-inset-bottom, 0px));
    z-index: var(--z-toast);
    max-width: calc(100% - 2 * #{$spacing-md});
    pointer-events: none;
  }

  .offline__pill {
    display: inline-flex;
    align-items: center;
    gap: $spacing-sm;
    margin: 0;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-full;
    @include glass(14px);
    box-shadow: 0 12px 32px rgb(var(--clr-shade-rgb) / 0.4);
    color: var(--clr-text);
    font-family: $font-body;
    font-size: 0.76rem;
    font-weight: 600;
    letter-spacing: 0.04em;

    @media (prefers-reduced-motion: no-preference) {
      animation: offline-in $dur-normal $ease-out-expo;
    }
  }

  .offline__dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: $radius-full;
    background: rgb(var(--clr-highlight-rgb));
  }

  .offline__detail {
    font-weight: 400;

    @include respond-to(sm) {
      @include sr-only;
    }
  }

  @keyframes offline-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
</style>
