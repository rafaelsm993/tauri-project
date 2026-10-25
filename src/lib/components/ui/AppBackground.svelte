<script lang="ts">
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import { UnlocksStore } from "$lib/stores/unlocks.svelte";
  import { particlesFor } from "$lib/domain/motifs";

  // The store prop exists for tests; the app uses the singleton.
  let {
    prefs = prefsStore,
    currentLevel = null,
  }: { prefs?: PrefsStore; currentLevel?: number | null } = $props();

  const equipment = $derived(new UnlocksStore(prefs, () => currentLevel));
  const motif = $derived(equipment.motif);

  // The motif derivation already waits for prefs, so an unloaded store yields no particles.
  const particles = $derived(particlesFor(motif, prefs.prefs.particle_count));

  let hidden = $state(false);
  let blurred = $state(false);
  const paused = $derived(hidden || blurred || !prefs.loaded || !prefs.prefs.motion);

  // Stops the infinite background loops while nobody can see them.
  $effect(() => {
    const onVisibility = () => (hidden = document.hidden);
    const onBlur = () => (blurred = true);
    const onFocus = () => (blurred = false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  });
</script>

<div class="bg-layer" aria-hidden="true">
  <div class="bg-area" class:paused>
    <ul class="circles" data-motif={motif}>
      {#each particles as p, i (i)}
        <li
          style:--p-left="{p.left}%"
          style:--p-size="{p.size}px"
          style:--p-duration="{p.duration}s"
          style:--p-delay="{p.delay}s"
          style:--p-opacity={p.opacity}
        ></li>
      {/each}
    </ul>
  </div>
  <div class="bg-vignette"></div>
</div>

<style lang="scss">
  .bg-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .bg-area {
    position: absolute;
    inset: 0;
    background: var(--clr-bg);

    // Smooth radial glows on the base background — blurred to eliminate banding.
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(
          ellipse 130% 90% at 15% 100%,
          rgb(var(--clr-primary-rgb) / 0.12) 0%,
          rgb(var(--clr-primary-rgb) / 0.06) 25%,
          rgb(var(--clr-primary-rgb) / 0.02) 45%,
          transparent 70%
        ),
        radial-gradient(
          ellipse 110% 80% at 85% 0%,
          rgb(var(--clr-accent-rgb) / 0.08) 0%,
          rgb(var(--clr-accent-rgb) / 0.03) 30%,
          transparent 60%
        );
      filter: blur(40px);
    }
  }

  .bg-area.paused .circles li {
    animation-play-state: paused;
  }

  // Measured on a Galaxy A34: one particle costs 143% CPU, twelve cost 188%, none cost 0.2%.
  // The price is compositing an animated full-screen layer at all, not the particle count, so
  // no count is affordable here. The glow and vignette stay.
  @include touch {
    .circles {
      display: none;
    }
  }

  .circles {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  // Every particle reads its own geometry from the motif; the keyframe comes from the layer.
  .circles li {
    position: absolute;
    display: block;
    list-style: none;
    bottom: calc(-1 * var(--p-size));
    left: var(--p-left);
    width: var(--p-size);
    height: var(--p-size);
    opacity: var(--p-opacity);
    animation-duration: var(--p-duration);
    animation-delay: var(--p-delay);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    will-change: transform;
  }

  .circles[data-motif="bubbles"] li {
    background: rgb(var(--clr-primary-rgb) / 1);
    animation-name: motif-rise;
  }

  .circles[data-motif="embers"] li {
    animation-name: motif-ember;
    background: rgb(var(--clr-accent-rgb) / 1);
    border-radius: 50%;
    filter: blur(1px);
  }

  .circles[data-motif="aurora"] li {
    animation-name: motif-drift;
    background: radial-gradient(
      circle,
      rgb(var(--clr-accent-rgb) / 0.9) 0%,
      rgb(var(--clr-primary-rgb) / 0.4) 45%,
      transparent 70%
    );
    border-radius: 50%;
    filter: blur(18px);
  }

  @keyframes motif-rise {
    0% {
      transform: translateY(0) rotate(0deg);
      border-radius: 0;
    }
    50% {
      border-radius: 25%;
    }
    100% {
      transform: translateY(-110vh) rotate(540deg);
      border-radius: 50%;
      opacity: 0;
    }
  }

  @keyframes motif-ember {
    0% {
      transform: translateY(0) translateX(0);
    }
    50% {
      transform: translateY(-55vh) translateX(6vw);
    }
    100% {
      transform: translateY(-110vh) translateX(-4vw);
      opacity: 0;
    }
  }

  @keyframes motif-drift {
    0% {
      transform: translateY(0) translateX(-6vw) scale(1);
    }
    50% {
      transform: translateY(-50vh) translateX(6vw) scale(1.35);
    }
    100% {
      transform: translateY(-100vh) translateX(-2vw) scale(1);
      opacity: 0;
    }
  }

  .bg-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 100% 100% at 50% 50%,
      transparent 25%,
      rgb(var(--clr-bg-rgb) / 0.4) 55%,
      rgb(var(--clr-bg-rgb) / 0.8) 100%
    );
    z-index: 1;
  }
</style>
