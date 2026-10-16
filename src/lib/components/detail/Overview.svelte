<script lang="ts">
  let { text }: { text: string } = $props();

  let open = $state(false);
  let long = $state(false);

  // Measures once the clamped text is laid out, and again when its width changes.
  function measure(node: HTMLElement) {
    const check = () => {
      if (!open) long = node.scrollHeight > node.clientHeight + 1;
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }
</script>

<div class="overview-wrap">
  <p class="overview" class:overview--open={open} {@attach measure}>{text}</p>
  {#if long}
    <button
      type="button"
      class="overview-toggle"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      {open ? "Show less" : "Read more"}
    </button>
  {/if}
</div>

<style lang="scss">
  .overview-wrap {
    margin-bottom: $spacing-xl;
  }

  .overview {
    font-size: 0.92rem;
    line-height: 1.7;
    color: var(--clr-text-2);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;

    &--open {
      display: block;
      -webkit-line-clamp: unset;
      line-clamp: unset;
    }
  }

  .overview-toggle {
    margin-top: $spacing-xs;
    padding: 0;
    background: none;
    border: none;
    color: var(--clr-primary);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
      border-radius: $radius-sm;
    }

    @include hover-capable {
      &:hover {
        text-decoration: underline;
      }
    }

    @include touch {
      min-height: $touch-target;
    }
  }
</style>
