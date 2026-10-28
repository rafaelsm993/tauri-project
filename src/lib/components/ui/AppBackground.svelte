<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { prefsStore, PrefsStore } from "$lib/stores/prefs.svelte";
  import { UnlocksStore } from "$lib/stores/unlocks.svelte";
  import { MotionStore } from "$lib/stores/motion.svelte";
  import { particlesFor } from "$lib/domain/motifs";

  let {
    prefs = prefsStore,
    currentLevel = null,
  }: { prefs?: PrefsStore; currentLevel?: number | null } = $props();
  const equipment = $derived(new UnlocksStore(prefs, () => currentLevel));
  const motion = $derived(new MotionStore(prefs));
  const motif = $derived(equipment.motif);
  const particles = $derived(particlesFor(motif, prefs.prefs.particle_count));
  const touch =
    typeof window === "undefined"
      ? { current: false }
      : new MediaQuery("(hover: none), (pointer: coarse)");
  let hidden = $state(false);
  let blurred = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  const paused = $derived(hidden || blurred || !prefs.loaded || !motion.on);

  $effect(() => {
    hidden = document.hidden;
    blurred = !document.hasFocus();
    const visibility = () => (hidden = document.hidden);
    const blur = () => (blurred = true);
    const focus = () => (blurred = false);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
    };
  });

  $effect(() => {
    const el = canvas,
      scene = particles,
      kind = motif;
    if (!el || !touch.current || paused || scene.length === 0) return;
    const ctx = el.getContext("2d", { alpha: true });
    if (!ctx) return;
    let width = 0,
      height = 0;
    let frame: number;
    let stopped = false;
    const started = performance.now();
    const interval = 1000 / 30;
    let last = started - interval;
    const resize = () => {
      width = el.clientWidth;
      height = el.clientHeight;
      const scale = Math.min(0.5, 240 / Math.max(1, width), 480 / Math.max(1, height));
      el.width = Math.max(1, Math.round(width * scale));
      el.height = Math.max(1, Math.round(height * scale));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const paint = (now: number) => {
      if (stopped) return;
      const delta = now - last;
      if (delta >= interval && width > 0 && height > 0) {
        last = now - (delta % interval);
        ctx.setTransform(el.width / width, 0, 0, el.height / height, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const styles = getComputedStyle(document.documentElement);
        const primary = `rgb(${styles.getPropertyValue("--clr-primary-rgb").trim()})`;
        const accent = `rgb(${styles.getPropertyValue("--clr-accent-rgb").trim()})`;
        const elapsed = (now - started) / 1000;
        scene.forEach((p, i) => {
          const raw = (elapsed - p.delay) / p.duration + (i + 1) / (scene.length + 1);
          const phase = ((raw % 1) + 1) % 1;
          const x =
            (width * p.left) / 100 +
            (kind === "embers" ? Math.sin(phase * Math.PI * 2) * width * 0.05 : 0);
          const y = height * (1 - phase);
          const size = p.size;
          ctx.save();
          ctx.translate(x, y);
          ctx.globalAlpha = p.opacity * (1 - phase);
          ctx.fillStyle = kind === "embers" ? accent : primary;
          if (kind === "bubbles") {
            ctx.rotate(phase * Math.PI * 3);
            ctx.beginPath();
            ctx.roundRect(-size / 2, -size / 2, size, size, (size * phase) / 2);
            ctx.fill();
          } else if (kind === "aurora") {
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
            glow.addColorStop(0, accent);
            glow.addColorStop(0.45, primary);
            glow.addColorStop(1, "transparent");
            ctx.fillStyle = glow;
            ctx.fillRect(-size, -size, size * 2, size * 2);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });
      }
      frame = requestAnimationFrame(paint);
    };
    paint(started);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
</script>

<div class="bg-layer" aria-hidden="true">
  <div class="bg-area" class:paused>
    {#if touch.current && !paused && particles.length > 0}<canvas
        class="mobile-motif"
        bind:this={canvas}
      ></canvas>{/if}
    <ul class="circles" data-motif={motif}>
      {#each particles as p, i (i)}
        <li
          style:--p-left="{p.left}%"
          style:--p-size="{p.size}px"
          style:--p-duration="{p.duration}s"
          style:--p-delay={`${-p.delay}s`}
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

  :global(:root[data-motion="on"]) .circles[data-motif="bubbles"] li {
    background: rgb(var(--clr-primary-rgb) / 1);
    animation-name: motif-rise;
  }

  :global(:root[data-motion="on"]) .circles[data-motif="embers"] li {
    animation-name: motif-ember;
    background: rgb(var(--clr-accent-rgb) / 1);
    border-radius: 50%;
    filter: blur(1px);
  }

  :global(:root[data-motion="on"]) .circles[data-motif="aurora"] li {
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
  .mobile-motif {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .paused .mobile-motif {
    visibility: hidden;
  }
</style>
