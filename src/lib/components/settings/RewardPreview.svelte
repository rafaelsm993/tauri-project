<script lang="ts">
  import { tokensFor } from "$lib/domain/themes";
  import type { Slot } from "$lib/stores/unlocks.svelte";
  let { label, slot, reward }: { label: string; slot: Slot; reward: string } = $props();
  const tokens = $derived({
    ...((slot === "accent" || slot === "pack") && reward === "default"
      ? { "--clr-primary-rgb": "var(--clr-base-primary-rgb)" }
      : {}),
    ...tokensFor(slot === "accent" ? reward : "default", slot === "pack" ? reward : "default"),
  });
  const local = $derived(
    Object.entries(tokens)
      .map(([key, value]) => `${key.replace("--clr-", "--preview-")}: ${value}`)
      .join("; "),
  );
</script>

<svg
  class="reward-preview"
  role="img"
  aria-label="{label} preview"
  shape-rendering={slot === "garden" ? "crispEdges" : undefined}
  viewBox="0 0 100 56"
  style={local}
>
  <rect class="ground" x="0" y="0" width="100" height="56" rx="4" />
  <rect class="panel" x="8" y="8" width="84" height="40" rx="2" />
  {#if slot === "motif" && reward === "bubbles"}
    <g class="mark"
      ><circle cx="27" cy="31" r="9" /><circle cx="51" cy="21" r="6" /><circle
        cx="73"
        cy="34"
        r="11"
      /></g
    >
  {:else if slot === "motif" && reward === "embers"}
    <path class="mark" d="m24 36 5-20 5 20-5 7z m23-8 4-16 4 16-4 6z m23 11 4-21 4 21-4 6z" />
  {:else if slot === "motif" && reward === "aurora"}
    <path class="mark" d="M13 36Q35 0 50 24T87 19v12Q65 50 50 35T13 44z" />
  {:else if slot === "garden"}
    <path
      class="mark"
      d={reward === "sway"
        ? "M46 44V30H38V26H30V22H22V14H26V20H34V24H42V28H48V12H52V24H60V20H68V12H72V22H64V26H56V30H52V44Z M45 18H55V20H51V26H49V20H45Z"
        : "M46 44V30H38V26H30V22H24V16H28V20H36V24H44V28H48V14H52V28H60V24H68V16H72V26H64V30H54V44Z"}
    />
  {:else}
    <rect class="mark" x="16" y="16" width="30" height="24" rx="2" />
    <path class="line" d="M54 19h28v4H54z m0 10h22v3H54z m0 8h15v3H54z" />
  {/if}
</svg>

<style lang="scss">
  .reward-preview {
    display: block;
    width: 100%;
    max-width: 8rem;
    height: auto;
  }
  .ground {
    fill: rgb(var(--preview-bg-rgb, var(--clr-base-bg-rgb)));
  }
  .panel {
    fill: rgb(var(--preview-surface-rgb, var(--clr-base-surface-rgb)));
  }
  .mark {
    fill: rgb(var(--preview-primary-rgb, var(--clr-primary-rgb)));
  }
  .line {
    fill: rgb(var(--preview-ink-rgb, var(--clr-ink-rgb)) / 0.6);
  }
</style>
