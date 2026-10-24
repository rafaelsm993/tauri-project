<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { pushState } from "$app/navigation";
  import { page } from "$app/state";
  import { dismissesSheet } from "$lib/utils/swipe";

  // A modal form: Escape, Back, the backdrop and a swipe down ask `onclose`; the parent unmounts it.
  // `onclosed` runs once its history entry is gone, so navigating then can't be undone by it.
  let {
    label,
    onclose,
    onclosed,
    size = "fit",
    focus = "field",
    children,
  }: {
    label: string;
    onclose: () => void;
    onclosed?: () => void;
    size?: "fit" | "full";
    // "sheet" keeps the cursor out of the fields: on a phone that keeps the keyboard down.
    focus?: "field" | "sheet";
    children: Snippet;
  } = $props();

  let dragY = $state(0);

  function modal(dialog: HTMLDialogElement) {
    const opener = document.activeElement as HTMLElement | null;
    const viewport = window.visualViewport;
    const fit = () => {
      const covered = viewport ? innerHeight - viewport.height - viewport.offsetTop : 0;
      dialog.style.setProperty("--sheet-covered", `${Math.max(0, Math.round(covered))}px`);
    };
    const back = () => {
      if (!page.state.sheet) onclose();
    };
    fit();
    viewport?.addEventListener("resize", fit);
    dialog.showModal();
    untrack(() => pushState("", { sheet: label }));
    addEventListener("popstate", back);
    const first = dialog.querySelector<HTMLElement>("input, textarea, select, button");
    (untrack(() => focus) === "sheet" ? dialog : first)?.focus();
    return () => {
      viewport?.removeEventListener("resize", fit);
      removeEventListener("popstate", back);
      const done = untrack(() => onclosed);
      if (page.state.sheet) {
        if (done) addEventListener("popstate", done, { once: true });
        history.back();
      } else {
        done?.();
      }
      opener?.focus();
    };
  }

  function ask(event: Event) {
    event.preventDefault();
    onclose();
  }

  function drag(handle: HTMLElement) {
    let startY = 0;
    const down = (e: PointerEvent) => {
      startY = e.clientY;
      handle.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (handle.hasPointerCapture(e.pointerId)) dragY = Math.max(0, e.clientY - startY);
    };
    const up = () => {
      const height = handle.closest("dialog")?.getBoundingClientRect().height ?? 0;
      const dismiss = dismissesSheet(dragY, height);
      dragY = 0;
      if (dismiss) onclose();
    };
    handle.addEventListener("pointerdown", down);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
    return () => {
      handle.removeEventListener("pointerdown", down);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
  }
</script>

<dialog
  class="sheet"
  class:full={size === "full"}
  aria-label={label}
  tabindex="-1"
  style:--sheet-drag="{dragY}px"
  {@attach modal}
  oncancel={ask}
  onkeydown={(event) => event.key === "Escape" && ask(event)}
  onclick={(event) => event.target === event.currentTarget && onclose()}
  onfocusin={(event) => (event.target as HTMLElement).scrollIntoView?.({ block: "nearest" })}
>
  <div class="sheet-handle" aria-hidden="true" {@attach drag}></div>
  <div class="sheet-body">
    {@render children()}
  </div>
</dialog>

<style lang="scss">
  .sheet {
    margin: auto;
    inset-block-end: var(--sheet-covered, 0px);
    max-width: calc(100vw - 2 * #{$spacing-md});
    max-height: calc(100dvh - var(--sheet-covered, 0px) - 2 * #{$spacing-md});
    padding: 0;
    overflow: auto;
    overscroll-behavior: contain;
    background: none;
    border: none;
    color: inherit;

    // Focused only as a starting point for keyboard and screen reader users, never to show.
    &:focus {
      outline: none;
    }

    &::backdrop {
      background: rgb(var(--clr-shade-rgb) / 0.6);
    }

    @include respond-to(md) {
      margin: auto 0 0;
      width: 100%;
      max-width: 100%;
      max-height: calc(90dvh - var(--sheet-covered, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      border-radius: $radius-lg $radius-lg 0 0;
      background: var(--clr-surface);
      transform: translateY(var(--sheet-drag, 0px));
      animation: sheet-up $dur-normal ease-out;
    }
  }

  // Long forms: wider on desktop, the whole height on a phone.
  .sheet.full {
    width: min(40rem, 100%);

    @include respond-to(md) {
      inset-block-start: env(safe-area-inset-top, 0px);
      height: calc(100dvh - env(safe-area-inset-top, 0px) - var(--sheet-covered, 0px));
      max-height: none;
      border-radius: 0;
    }
  }

  .sheet-handle {
    display: none;

    @include respond-to(md) {
      display: block;
      width: 40px;
      height: $touch-target;
      margin-inline: auto;
      padding-block: 20px;
      background: rgb(var(--clr-ink-rgb) / 0.25);
      background-clip: content-box;
      border-radius: $radius-full;
      touch-action: none;
      cursor: grab;
    }
  }

  .sheet-body {
    min-width: 0;

    @include respond-to(md) {
      > :global(*) {
        width: 100%;
        border: none;
        border-radius: 0;
        padding-top: 0;
      }
    }
  }

  @keyframes sheet-up {
    from {
      transform: translateY(100%);
    }
  }
</style>
