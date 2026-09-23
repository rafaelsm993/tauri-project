<script lang="ts">
  import { onDestroy } from "svelte";
  import { ui } from "$lib/stores/ui.svelte";

  const BUBBLE_COUNT = 20;
  let pulsing = $state(false);
  let pulseTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    const click = ui.lastClick;
    if (click) {
      pulsing = true;
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => {
        pulsing = false;
      }, 900);
    }
  });

  onDestroy(() => {
    clearTimeout(pulseTimer);
  });
</script>

<div class="bg-layer" aria-hidden="true">
  <div class="bg-area" class:pulsing>
    <ul class="circles">
      <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- skeleton placeholder, only the index is used -->
      {#each { length: BUBBLE_COUNT } as _, i (i)}
        <li></li>
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

  // ── Floating bubbles ──
  .bg-area {
    position: absolute;
    inset: 0;
    background: var(--clr-bg);

    // Smooth radial red glows on solid black — blurred to eliminate banding
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

  .circles {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .circles li {
    position: absolute;
    display: block;
    list-style: none;
    width: 20px;
    height: 20px;
    background: rgb(var(--clr-primary-rgb) / 0.1);
    animation: float 18s linear infinite;
    bottom: -160px;
  }

  // ── 20 bubbles: varied sizes, positions, speeds ──
  .circles li:nth-child(1) {
    left: 5%;
    width: 70px;
    height: 70px;
    animation-duration: 10s;
    animation-delay: 0s;
    background: rgb(var(--clr-primary-rgb) / 0.1);
  }
  .circles li:nth-child(2) {
    left: 15%;
    width: 18px;
    height: 18px;
    animation-duration: 7s;
    animation-delay: 1s;
    background: rgb(var(--clr-accent-rgb) / 0.14);
  }
  .circles li:nth-child(3) {
    left: 25%;
    width: 90px;
    height: 90px;
    animation-duration: 14s;
    animation-delay: 0s;
    background: rgb(var(--clr-primary-rgb) / 0.07);
  }
  .circles li:nth-child(4) {
    left: 35%;
    width: 14px;
    height: 14px;
    animation-duration: 8s;
    animation-delay: 2s;
    background: rgb(var(--clr-primary-rgb) / 0.16);
  }
  .circles li:nth-child(5) {
    left: 42%;
    width: 55px;
    height: 55px;
    animation-duration: 11s;
    animation-delay: 0.5s;
    background: rgb(var(--clr-accent-rgb) / 0.09);
  }
  .circles li:nth-child(6) {
    left: 52%;
    width: 120px;
    height: 120px;
    animation-duration: 16s;
    animation-delay: 3s;
    background: rgb(var(--clr-primary-rgb) / 0.05);
  }
  .circles li:nth-child(7) {
    left: 60%;
    width: 22px;
    height: 22px;
    animation-duration: 6s;
    animation-delay: 1.5s;
    background: rgb(var(--clr-primary-rgb) / 0.14);
  }
  .circles li:nth-child(8) {
    left: 70%;
    width: 40px;
    height: 40px;
    animation-duration: 9s;
    animation-delay: 0s;
    background: rgb(var(--clr-accent-rgb) / 0.11);
  }
  .circles li:nth-child(9) {
    left: 80%;
    width: 16px;
    height: 16px;
    animation-duration: 7s;
    animation-delay: 4s;
    background: rgb(var(--clr-primary-rgb) / 0.18);
  }
  .circles li:nth-child(10) {
    left: 90%;
    width: 130px;
    height: 130px;
    animation-duration: 13s;
    animation-delay: 0s;
    background: rgb(var(--clr-primary-rgb) / 0.04);
  }
  .circles li:nth-child(11) {
    left: 2%;
    width: 28px;
    height: 28px;
    animation-duration: 8s;
    animation-delay: 2.5s;
    background: rgb(var(--clr-accent-rgb) / 0.12);
  }
  .circles li:nth-child(12) {
    left: 18%;
    width: 50px;
    height: 50px;
    animation-duration: 10s;
    animation-delay: 1s;
    background: rgb(var(--clr-primary-rgb) / 0.08);
  }
  .circles li:nth-child(13) {
    left: 30%;
    width: 12px;
    height: 12px;
    animation-duration: 5s;
    animation-delay: 0s;
    background: rgb(var(--clr-primary-rgb) / 0.2);
  }
  .circles li:nth-child(14) {
    left: 48%;
    width: 80px;
    height: 80px;
    animation-duration: 12s;
    animation-delay: 3.5s;
    background: rgb(var(--clr-accent-rgb) / 0.06);
  }
  .circles li:nth-child(15) {
    left: 55%;
    width: 16px;
    height: 16px;
    animation-duration: 6s;
    animation-delay: 0.8s;
    background: rgb(var(--clr-primary-rgb) / 0.16);
  }
  .circles li:nth-child(16) {
    left: 65%;
    width: 100px;
    height: 100px;
    animation-duration: 15s;
    animation-delay: 2s;
    background: rgb(var(--clr-primary-rgb) / 0.05);
  }
  .circles li:nth-child(17) {
    left: 75%;
    width: 24px;
    height: 24px;
    animation-duration: 7s;
    animation-delay: 1.2s;
    background: rgb(var(--clr-accent-rgb) / 0.13);
  }
  .circles li:nth-child(18) {
    left: 85%;
    width: 45px;
    height: 45px;
    animation-duration: 9s;
    animation-delay: 0s;
    background: rgb(var(--clr-primary-rgb) / 0.09);
  }
  .circles li:nth-child(19) {
    left: 10%;
    width: 10px;
    height: 10px;
    animation-duration: 4s;
    animation-delay: 0.3s;
    background: rgb(var(--clr-primary-rgb) / 0.22);
  }
  .circles li:nth-child(20) {
    left: 95%;
    width: 35px;
    height: 35px;
    animation-duration: 8s;
    animation-delay: 5s;
    background: rgb(var(--clr-accent-rgb) / 0.1);
  }

  // Pulse — flash bubbles brighter on card click
  .bg-area.pulsing .circles li {
    background: rgb(var(--clr-primary-rgb) / 0.3);
    transition: background 0.2s ease-out;
  }

  @keyframes float {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
      border-radius: 0;
    }
    50% {
      opacity: 0.6;
      border-radius: 25%;
    }
    100% {
      transform: translateY(-110vh) rotate(540deg);
      opacity: 0;
      border-radius: 50%;
    }
  }

  // ── Vignette ──
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
