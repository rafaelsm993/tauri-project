<script lang="ts">
  // Scrolls the window: the document is the scroller, `.app-content` has no overflow.
  let {
    threshold,
    label = "Back to top",
  }: {
    /** Pixels scrolled before the button appears. Defaults to one viewport height. */
    threshold?: number;
    label?: string;
  } = $props();

  let scrollY = $state(0);
  let viewportHeight = $state(0);

  const visible = $derived(scrollY > (threshold ?? viewportHeight));

  $effect(() => {
    const read = () => {
      scrollY = window.scrollY;
      viewportHeight = window.innerHeight;
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read, { passive: true });
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  });

  function scrollToTop() {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" });
  }
</script>

<!-- Rendered only while visible, so it is never in the tab order when hidden. -->
{#if visible}
  <button type="button" class="back-to-top" onclick={scrollToTop}>
    <svg
      class="back-to-top__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
    <span class="back-to-top__label">{label}</span>
  </button>
{/if}

<style lang="scss">
  .back-to-top {
    position: fixed;
    right: calc(#{$spacing-lg} + env(safe-area-inset-right, 0px));
    bottom: calc(#{$spacing-lg} + env(safe-area-inset-bottom, 0px));
    z-index: 10;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    min-height: 36px;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-full;
    @include glass(14px);
    box-shadow: 0 12px 32px rgb(var(--clr-shade-rgb) / 0.4);
    color: var(--clr-text);
    font-family: $font-body;
    font-size: 0.76rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    cursor: pointer;
    transition:
      color $dur-normal ease,
      background $dur-normal ease,
      border-color $dur-normal ease,
      box-shadow $dur-normal ease;

    @media (prefers-reduced-motion: no-preference) {
      animation: back-to-top-in $dur-normal $ease-out-expo;
    }

    @include hover-capable {
      &:hover {
        color: var(--clr-bg);
        background: var(--clr-primary);
        border-color: var(--clr-primary);
        @include glow-primary;
      }
    }

    &:focus-visible {
      outline: 2px solid var(--clr-primary);
      outline-offset: 3px;
    }

    @include touch {
      min-width: $touch-target;
      min-height: $touch-target;
    }

    // Phones: icon-only circle so it covers as little content as possible.
    // The label stays in the accessibility tree (sr-only).
    @include respond-to(sm) {
      right: calc(#{$spacing-md} + env(safe-area-inset-right, 0px));
      bottom: calc(#{$spacing-md} + env(safe-area-inset-bottom, 0px));
      width: $touch-target;
      height: $touch-target;
      padding: 0;
    }
  }

  .back-to-top__icon {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
  }

  .back-to-top__label {
    @include respond-to(sm) {
      @include sr-only;
    }
  }

  @keyframes back-to-top-in {
    from {
      opacity: 0;
      transform: translateY($spacing-sm);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
