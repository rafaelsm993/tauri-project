<script lang="ts">
  // 16:9 YouTube embed.
  let { videoKey, name }: { videoKey: string; name: string } = $props();
</script>

<div class="trailer-wrapper">
  <iframe
    src="https://www.youtube.com/embed/{videoKey}?rel=0&modestbranding=1"
    title={name}
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</div>

<style lang="scss">
  .trailer-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: $radius-md;
    overflow: hidden;
    background: var(--clr-surface);
    border: 1px solid rgb(var(--clr-ink-rgb) / 0.05);
    transition: box-shadow $dur-normal $ease-out-expo;

    &:hover {
      box-shadow:
        0 0 0 2px var(--clr-primary),
        0 8px 32px rgb(var(--clr-shade-rgb) / 0.5);
    }

    iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }
  }
</style>
