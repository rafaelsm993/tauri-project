<script lang="ts">
  import { STAR_PATHS, STAR_SIZE } from "$lib/components/ui/pixelStar";
  import { ratingAt, ratingKey, ratingText, starFill } from "$lib/domain/rating";

  // Five pixel stars over a 1–10 rating, a point per half star. Tap, swipe across, or use the keys;
  // tapping the current value again clears it.
  let {
    value,
    onchange,
    disabled = false,
  }: {
    value: number | null;
    onchange: (value: number | null) => void;
    disabled?: boolean;
  } = $props();

  const id = $props.id();
  const STARS = [0, 1, 2, 3, 4];
  let stars = $state<HTMLElement>();
  // While a finger or the mouse is down the stars follow it; hover previews with a mouse only.
  let dragging = $state<number | null>(null);
  let hovering = $state<number | null>(null);
  let moved = false;
  // Bumped on every raise so the pop and sparks replay on the stars it lit.
  let burst = $state({ key: 0, from: 0, to: 0 });

  const shown = $derived(dragging ?? hovering ?? value);
  const lit = $derived(
    burst.key === 0 ? [] : STARS.filter((i) => starFill(burst.to, i) !== starFill(burst.from, i)),
  );

  function at(event: PointerEvent): number {
    const rect = stars!.getBoundingClientRect();
    return ratingAt(event.clientX - rect.left, rect.width);
  }

  function commit(next: number | null) {
    if (next === value) return;
    if (next !== null && next > (value ?? 0)) {
      burst = { key: burst.key + 1, from: value ?? 0, to: next };
    }
    onchange(next);
  }

  function down(event: PointerEvent) {
    if (disabled || event.button > 0) return;
    stars!.setPointerCapture?.(event.pointerId);
    moved = false;
    hovering = null;
    dragging = at(event);
  }

  function move(event: PointerEvent) {
    if (disabled) return;
    if (dragging === null) {
      if (event.pointerType === "mouse") hovering = at(event);
      return;
    }
    const next = at(event);
    if (next !== dragging) {
      moved = true;
      dragging = next;
    }
  }

  function up() {
    if (dragging === null) return;
    const picked = dragging;
    dragging = null;
    commit(!moved && picked === value ? null : picked);
  }

  function key(event: KeyboardEvent) {
    if (disabled) return;
    const next = ratingKey(value, event.key);
    if (next === undefined) return;
    event.preventDefault();
    commit(next);
  }
</script>

<div class="star-rating">
  <div
    bind:this={stars}
    class="stars"
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-label="Rating"
    aria-valuemin="0"
    aria-valuemax="10"
    aria-valuenow={shown ?? 0}
    aria-valuetext={ratingText(shown)}
    aria-disabled={disabled}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={() => (dragging = null)}
    onpointerleave={() => (hovering = null)}
    onkeydown={key}
  >
    {#each STARS as i (i)}
      {@const fill = starFill(shown, i)}
      {@const order = lit.indexOf(i)}
      <span class="star" data-fill={fill}>
        {#key order >= 0 ? burst.key : 0}
          <svg
            class="sprite"
            class:pop={order >= 0}
            style:--delay="{Math.max(order, 0) * 50}ms"
            viewBox="0 0 {STAR_SIZE} {STAR_SIZE}"
            shape-rendering="crispEdges"
            aria-hidden="true"
          >
            <clipPath id="{id}-clip-{i}">
              <rect
                width={fill === "full" ? STAR_SIZE : fill === "half" ? 8 : 0}
                height={STAR_SIZE}
              />
            </clipPath>
            <g class="empty">
              <path class="outline" d={STAR_PATHS.outline} />
              <path class="body" d={STAR_PATHS.body + STAR_PATHS.glint} />
            </g>
            <g class="lit" clip-path="url(#{id}-clip-{i})">
              <path class="outline" d={STAR_PATHS.outline} />
              <path class="body" d={STAR_PATHS.body} />
              <path class="glint" d={STAR_PATHS.glint} />
            </g>
          </svg>
          {#if order >= 0}
            <span class="sparks" style:--delay="{order * 50}ms" aria-hidden="true">
              <i></i><i></i><i></i><i></i><b></b>
            </span>
          {/if}
        {/key}
      </span>
    {/each}
  </div>
  <span class="rating-word" aria-hidden="true">{ratingText(shown)}</span>
</div>

<style lang="scss">
  .star-rating {
    // The pale accent of a lit star's glint and its twinkle.
    --glint: color-mix(in srgb, var(--clr-accent) 35%, rgb(var(--clr-glint-rgb)));
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  // Equal cells with no gap between them, so a point's x maps straight to its half star.
  .stars {
    display: flex;
    padding-block: 7px; // 30 px stars + 14 = a 44 px target
    border-radius: $radius-sm;
    touch-action: pan-y; // a sideways swipe rates; an up/down one still scrolls the page
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    &[aria-disabled="true"] {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .star {
    position: relative;
    display: block;
    padding-inline: 2px;
  }

  // 2 css px per sprite pixel; keep it a whole multiple or the pixels blur.
  .sprite {
    display: block;
    width: 30px;
    height: 30px;
    transform-origin: 50% 50%;
  }

  .empty .outline {
    fill: rgb(var(--clr-ink-rgb) / 0.22);
  }

  .empty .body {
    fill: rgb(var(--clr-ink-rgb) / 0.06);
  }

  // Lit stars take the equipped accent: a darker accent edge, the accent body, a pale accent glint.
  .lit .outline {
    fill: color-mix(in srgb, var(--clr-accent) 60%, rgb(var(--clr-shade-rgb)));
  }

  .lit .body {
    fill: var(--clr-accent);
  }

  .lit .glint {
    fill: var(--glint);
  }

  .rating-word {
    font-size: 0.85rem;
    color: var(--clr-text-2);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  // ── The burst (Animations on only): a stepped pop, four square sparks, a plus-shaped twinkle. ──
  .sparks {
    display: none;
  }

  :global(:root[data-motion="on"]) .sprite.pop {
    animation: star-pop 0.36s steps(4, end) var(--delay) both;
  }

  :global(:root[data-motion="on"]) .sparks {
    display: block;
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .sparks i {
    position: absolute;
    left: calc(50% - 2px);
    top: calc(50% - 2px);
    width: 4px;
    height: 4px;
    background: var(--clr-accent);
    opacity: 0;
    animation: star-spark 0.42s steps(3, end) var(--delay) both;

    &:nth-child(1) {
      --dx: -14px;
      --dy: -14px;
    }

    &:nth-child(2) {
      --dx: 14px;
      --dy: -14px;
    }

    &:nth-child(3) {
      --dx: -14px;
      --dy: 14px;
    }

    &:nth-child(4) {
      --dx: 14px;
      --dy: 14px;
    }
  }

  .sparks b {
    position: absolute;
    right: -2px;
    top: -2px;
    width: 10px;
    height: 10px;
    background:
      linear-gradient(var(--glint), var(--glint)) center / 2px 100% no-repeat,
      linear-gradient(var(--glint), var(--glint)) center / 100% 2px no-repeat;
    transform: scale(0);
    animation: star-twinkle 0.5s steps(3, end) calc(var(--delay) + 0.12s) both;
  }

  @keyframes star-pop {
    0% {
      transform: scale(0.6);
    }
    50% {
      transform: scale(1.25);
    }
    75% {
      transform: scale(0.9);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes star-spark {
    0% {
      opacity: 1;
      transform: translate(0, 0);
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), var(--dy));
    }
  }

  @keyframes star-twinkle {
    0%,
    100% {
      transform: scale(0);
    }
    50% {
      transform: scale(1);
    }
  }
</style>
