<script lang="ts">
  import ProfileArtwork from "$lib/components/profile/ProfileArtwork.svelte";
  import RewardPreview from "$lib/components/settings/RewardPreview.svelte";
  import { journeyEdges, type TreeMapNode } from "$lib/domain/progressionTree";
  import { beatDelay, igniteOrder } from "$lib/domain/ambient";

  let {
    nodes,
    media = false,
    reveal = false,
    rootArt,
    onselect,
  }: {
    nodes: TreeMapNode[];
    media?: boolean;
    reveal?: boolean;
    rootArt?: string;
    onselect: (id: string) => void;
  } = $props();
  const id = $props.id();
  const edges = $derived(media ? journeyEdges(nodes) : []);
  // Joins the shared beat when the map mounts, so opening a subtree doesn't restart the sky.
  const beat = beatDelay(performance.now());
  // Seals light from the tree's origin: the crown at the top, or a subtree's root at the bottom.
  const order = (y: number) => igniteOrder(media ? 100 - y : y);
  let map = $state<HTMLDivElement>();
  let offscreen = $state(false);
  // DOM side effect: a map scrolled out of view stops spending frames.
  $effect(() => {
    if (!map || !reveal || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => (offscreen = !e.isIntersecting));
    io.observe(map);
    return () => io.disconnect();
  });
  const MAIN_CHANNELS =
    "M50 5H46.88V6.88H43.75V8.75H40.62V10.62H37.5V12.5H34.38V14.38H31.25V16.25H28.12V18.12H25.0V20.0 M50 5H53.12V6.88H56.25V8.75H59.38V10.62H62.5V12.5H65.62V14.38H68.75V16.25H71.88V18.12H75.0V20.0 M25 20H31.25V20.0H37.5V20.0H43.75V20.0H50.0V20.0H56.25V20.0H62.5V20.0H68.75V20.0H75.0V20.0 M25 20H28.12V21.75H31.25V23.5H34.38V25.25H37.5V27.0H40.62V28.75H43.75V30.5H46.88V32.25H50.0V34.0 M75 20H71.88V21.75H68.75V23.5H65.62V25.25H62.5V27.0H59.38V28.75H56.25V30.5H53.12V32.25H50.0V34.0 M50 34H46.88V35.75H43.75V37.5H40.62V39.25H37.5V41.0H34.38V42.75H31.25V44.5H28.12V46.25H25.0V48.0 M50 34H53.12V35.75H56.25V37.5H59.38V39.25H62.5V41.0H65.62V42.75H68.75V44.5H71.88V46.25H75.0V48.0 M25 48H31.25V48.0H37.5V48.0H43.75V48.0H50.0V48.0H56.25V48.0H62.5V48.0H68.75V48.0H75.0V48.0 M25 48H28.12V49.75H31.25V51.5H34.38V53.25H37.5V55.0H40.62V56.75H43.75V58.5H46.88V60.25H50.0V62.0 M75 48H71.88V49.75H68.75V51.5H65.62V53.25H62.5V55.0H59.38V56.75H56.25V58.5H53.12V60.25H50.0V62.0 M50 62H46.88V63.75H43.75V65.5H40.62V67.25H37.5V69.0H34.38V70.75H31.25V72.5H28.12V74.25H25.0V76.0 M50 62H53.12V63.75H56.25V65.5H59.38V67.25H62.5V69.0H65.62V70.75H68.75V72.5H71.88V74.25H75.0V76.0 M25 76H31.25V76.0H37.5V76.0H43.75V76.0H50.0V76.0H56.25V76.0H62.5V76.0H68.75V76.0H75.0V76.0 M25 76H28.12V78.38H31.25V80.75H34.38V83.12H37.5V85.5H40.62V87.88H43.75V90.25H46.88V92.62H50.0V95.0 M75 76H71.88V78.38H68.75V80.75H65.62V83.12H62.5V85.5H59.38V87.88H56.25V90.25H53.12V92.62H50.0V95.0 M50 5H50.0V16.25H50.0V27.5H50.0V38.75H50.0V50.0H50.0V61.25H50.0V72.5H50.0V83.75H50.0V95.0";
</script>

<div
  class="runic-map"
  class:media
  bind:this={map}
  class:reveal
  class:offscreen
  style:--beat-delay={beat}
  role="group"
  aria-label={media ? "Journey milestones" : "Explore media trees"}
  aria-describedby={media ? `${id}-connections` : undefined}
>
  {#if media}<p class="node-detail" id="{id}-connections">
      Connections show the layout, not additional unlock requirements.
    </p>{/if}
  <svg
    class="channels"
    aria-hidden="true"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    shape-rendering="crispEdges"
  >
    {#if media}
      {#each edges as edge (edge.id)}
        <g
          class="journey-edge"
          class:earned={edge.available}
          data-from={edge.from}
          data-to={edge.to}
        >
          <path class="channel-stone" d={edge.d} />
          <path class="channel-engraving" d={edge.d} />
          {#if reveal && edge.available}<path
              class="channel-spark"
              d={edge.d}
              pathLength="100"
            />{/if}
        </g>
      {/each}
    {:else}
      <path class="channel-stone" d={MAIN_CHANNELS} />
      <path class="channel-engraving" d={MAIN_CHANNELS} />
      {#if reveal}<path class="channel-spark" d={MAIN_CHANNELS} pathLength="100" />{/if}
    {/if}
  </svg>
  <svg class="tree-crown" aria-hidden="true" viewBox="0 0 24 24" shape-rendering="crispEdges">
    <path class="seal-stone" d="M6 1H18V4H21V20H18V23H6V20H3V4H6Z" />
    <path
      class="rune"
      d="M11 4H13V7H16V9H18V15H16V17H13V20H11V17H8V15H6V9H8V7H11ZM11 8H9V10H8V14H10V16H14V14H16V10H14V8Z"
    />
  </svg>
  {#if !media}
    {#each [34, 62, 95] as y (y)}
      <span class="axis-seal" style:top="{y}%" aria-hidden="true">◇</span>
    {/each}
  {:else if rootArt}
    <span class="map-root" aria-hidden="true"
      ><ProfileArtwork art={rootArt} size={32} decorative /></span
    >
  {/if}
  {#each nodes as node (node.id)}
    <button
      type="button"
      class="map-node"
      class:available={node.available !== false}
      class:locked={node.available === false}
      data-node={node.id}
      data-kind={node.kind}
      aria-label={node.label}
      aria-describedby={`${id}-${node.id}`}
      style:--node-width={nodes.filter((other) => other.y === node.y).length === 3 ? "26%" : "40%"}
      style:left="{node.x}%"
      style:--order={order(node.y)}
      style:top="calc({node.y}% - var(--seal-size) / 2)"
      onclick={() => onselect(node.id)}
    >
      <span class="node-seal" aria-hidden="true">
        {#if node.art}
          <ProfileArtwork art={node.art} size={32} decorative />
        {:else if node.kind === "title"}
          <span class="title-glyph">Aa</span>
        {:else if node.kind && node.kind !== "art" && node.rewardId}
          <RewardPreview label={node.title} slot={node.kind} reward={node.rewardId} />
        {/if}
      </span>
      <span class="node-copy" id={`${id}-${node.id}`}>
        <strong>{node.title}</strong><span>{node.caption}</span>
        {#if node.detail}<span class="node-detail">{node.detail}</span>{/if}
        {#if node.available !== undefined}
          <span class="node-state">
            {#if !node.available}
              <svg data-lock aria-hidden="true" viewBox="0 0 12 12" shape-rendering="crispEdges"
                ><path d="M3 5V2H9V5H11V11H1V5ZM4 5H8V3H4Z" /></svg
              >
            {/if}
            {node.available ? "Available" : "Locked"}
          </span>
        {/if}
      </span>
    </button>
  {/each}
</div>

<style lang="scss">
  .runic-map {
    --seal-size: 4rem;
    --stone: color-mix(in srgb, var(--clr-accent) 25%, var(--clr-surface));
    --engraving: color-mix(in srgb, var(--clr-accent) 52%, var(--clr-surface));
    position: relative;
    width: min(32rem, 100%);
    max-width: 100%;
    height: 38rem;
    margin-inline: auto;
    isolation: isolate;
  }
  .channels {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .channel-stone {
    fill: none;
    stroke: var(--stone);
    stroke-width: 1.2;
  }
  .channel-engraving {
    fill: none;
    stroke: var(--engraving);
    stroke-width: 0.3;
  }
  .tree-crown {
    position: absolute;
    top: 5%;
    left: 50%;
    width: 2rem;
    height: 2rem;
    transform: translate(-50%, -50%);
  }
  .seal-stone {
    fill: var(--stone);
  }
  .rune {
    fill: var(--clr-accent);
  }
  .axis-seal {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--clr-surface);
    color: var(--clr-accent);
    border: 2px solid var(--engraving);
    padding: 0.1rem 0.35rem;
    font-size: 1rem;
  }
  .map-root {
    position: absolute;
    top: 95%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--clr-surface);
    padding: $spacing-xs;
  }
  .map-node {
    position: absolute;
    width: 44%;
    max-width: 10rem;
    min-width: $touch-target;
    min-height: $touch-target;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    gap: $spacing-xs;
    border: none;
    background: none;
    color: var(--clr-text);
    font: inherit;
    cursor: pointer;
    scroll-margin-block: 6rem;
  }
  .node-seal {
    display: grid;
    place-items: center;
    width: var(--seal-size);
    height: var(--seal-size);
    border: 2px solid var(--clr-border-2);
    background: var(--clr-bg);
    box-shadow: inset 0 0 0 3px var(--clr-surface);
    clip-path: polygon(
      8px 0,
      calc(100% - 8px) 0,
      calc(100% - 8px) 4px,
      calc(100% - 4px) 4px,
      calc(100% - 4px) 8px,
      100% 8px,
      100% calc(100% - 8px),
      calc(100% - 4px) calc(100% - 8px),
      calc(100% - 4px) calc(100% - 4px),
      calc(100% - 8px) calc(100% - 4px),
      calc(100% - 8px) 100%,
      8px 100%,
      8px calc(100% - 4px),
      4px calc(100% - 4px),
      4px calc(100% - 8px),
      0 calc(100% - 8px),
      0 8px,
      4px 8px,
      4px 4px,
      8px 4px
    );
  }
  .available .node-seal {
    border-color: var(--clr-accent);
    background: var(--stone);
  }
  .node-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: $spacing-xs;
    background: var(--clr-surface);
    gap: 0.2rem;
    line-height: 1.3;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  strong {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .node-copy > span {
    font-size: 0.7rem;
    color: var(--clr-text-2);
  }
  .node-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-xs;
    font-weight: 600;
  }
  .node-state svg {
    width: 0.75rem;
    height: 0.75rem;
    fill: currentColor;
  }
  .locked :global(.profile-artwork),
  .locked :global(.reward-preview) {
    filter: saturate(0.35);
  }
  .map-node:focus-visible {
    outline: 2px solid var(--clr-accent);
    outline-offset: 4px;
  }
  @include hover-capable {
    .map-node:hover .node-seal {
      border-color: var(--clr-accent);
      box-shadow: inset 0 0 0 3px var(--engraving);
    }
  }
  .reveal .channels,
  .reveal .tree-crown .rune,
  .reveal .map-root {
    animation: runic-reveal $dur-slower ease-out 1;
  }
  @keyframes runic-reveal {
    from {
      opacity: 0.25;
    }
    to {
      opacity: 1;
    }
  }

  // Starfield: two tiled dot layers that twinkle out of step behind the tree.
  .runic-map.reveal::before,
  .runic-map.reveal::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-repeat: repeat;
    opacity: 0.2;
    animation: sky-twinkle 6s ease-in-out var(--beat-delay) infinite;
  }
  .runic-map.reveal::before {
    background-image:
      radial-gradient(circle, rgb(var(--clr-accent-rgb) / 0.9) 0 1px, transparent 1.5px),
      radial-gradient(circle, rgb(var(--clr-primary-rgb) / 0.7) 0 1px, transparent 1.5px);
    background-size:
      53px 61px,
      89px 97px;
    background-position:
      7px 11px,
      31px 43px;
  }
  .runic-map.reveal::after {
    background-image: radial-gradient(
      circle,
      rgb(var(--clr-accent-rgb) / 1) 0 1.5px,
      transparent 2px
    );
    background-size: 131px 149px;
    background-position: 67px 23px;
    animation-duration: 9s;
    animation-direction: alternate-reverse;
  }
  @keyframes sky-twinkle {
    0%,
    100% {
      opacity: 0.15;
    }
    50% {
      opacity: 0.6;
    }
  }

  // Starlight: short dashes run along every lit channel, stepped so Android repaints 24×/s, not 60×/s.
  .channel-spark {
    fill: none;
    stroke: var(--clr-accent);
    stroke-width: 0.7;
    stroke-linecap: square;
    stroke-dasharray: 1.5 18.5;
    animation: star-travel 6s steps(144) var(--beat-delay) infinite;
  }
  .journey-edge .channel-spark {
    stroke-width: 3px;
    vector-effect: non-scaling-stroke;
  }
  @keyframes star-travel {
    to {
      stroke-dashoffset: -100;
    }
  }

  // Each seal ignites once from the tree's origin, then its halo breathes in a wave along the tree.
  .reveal .node-seal {
    animation: star-ignite 500ms ease-out both;
    animation-delay: calc(var(--order) * 90ms);
  }
  @keyframes star-ignite {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .reveal .map-node::before {
    content: "";
    position: absolute;
    top: calc(var(--seal-size) * -0.4);
    left: 50%;
    width: calc(var(--seal-size) * 1.8);
    height: calc(var(--seal-size) * 1.8);
    margin-left: calc(var(--seal-size) * -0.9);
    z-index: -1;
    pointer-events: none;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgb(var(--clr-accent-rgb) / 0.55) 0%,
      rgb(var(--clr-primary-rgb) / 0.18) 40%,
      transparent 70%
    );
    animation: star-twinkle 6s ease-in-out infinite;
    animation-delay: calc(var(--beat-delay) - var(--order) * 0.45s);
  }
  .reveal .map-node.locked::before {
    --twinkle-peak: 0.35;
  }
  @keyframes star-twinkle {
    0%,
    100% {
      opacity: 0.2;
      transform: scale(0.85);
    }
    50% {
      opacity: var(--twinkle-peak, 0.95);
      transform: scale(1.12);
    }
  }
  // The ◇ seals keep their translate; only their opacity pulses.
  .reveal .axis-seal {
    animation: seal-pulse 6s ease-in-out var(--beat-delay) infinite;
  }
  @keyframes seal-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  // Off screen or while the app is away, every loop holds its frame, in step with the background.
  :global(:root[data-ambient="paused"]) .reveal,
  .offscreen.reveal {
    --play: paused;
  }
  .runic-map.reveal::before,
  .runic-map.reveal::after,
  .channel-spark,
  .reveal .map-node::before,
  .reveal .axis-seal {
    animation-play-state: var(--play, running);
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal .channels,
    .reveal .tree-crown .rune,
    .reveal .map-root,
    .reveal .node-seal,
    .reveal .map-node::before,
    .reveal .axis-seal,
    .runic-map.reveal::before,
    .runic-map.reveal::after,
    .channel-spark {
      animation: none;
    }
    .reveal .map-node::before,
    .runic-map.reveal::before,
    .runic-map.reveal::after {
      opacity: 0;
    }
  }
  .runic-map,
  .map-root,
  .node-copy,
  .node-seal,
  .map-node {
    transition: none;
  }
  .runic-map.media {
    --seal-size: 3rem;
    height: 64rem;
  }
  .media .map-node {
    width: var(--node-width);
    max-width: 8rem;
  }
  .media .node-copy {
    padding-inline: 0;
  }
  .media .tree-crown {
    visibility: hidden;
  }
  .media .map-root {
    top: 96%;
  }
  .node-seal :global(.reward-preview) {
    width: 2rem;
    max-height: 2rem;
  }
  .title-glyph {
    font-family: $font-display;
    font-size: 1.1rem;
    color: var(--clr-accent);
  }
  .node-detail {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .journey-edge .channel-stone {
    stroke-width: 5px;
    vector-effect: non-scaling-stroke;
    stroke: var(--clr-border-2);
  }
  .journey-edge .channel-engraving {
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    stroke: var(--clr-text-3);
  }
  .journey-edge.earned .channel-stone {
    stroke: var(--engraving);
  }
  .journey-edge.earned .channel-engraving {
    stroke: var(--clr-accent);
  }
</style>
