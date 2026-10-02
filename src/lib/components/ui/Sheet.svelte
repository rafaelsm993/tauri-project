<script lang="ts">
  import type { Snippet } from "svelte";

  // A modal form: Escape, the back gesture and the backdrop ask `onclose`; the parent unmounts it.
  let { label, onclose, children }: { label: string; onclose: () => void; children: Snippet } =
    $props();

  function modal(dialog: HTMLDialogElement) {
    const opener = document.activeElement as HTMLElement | null;
    const viewport = window.visualViewport;
    const fit = () => {
      const covered = viewport ? innerHeight - viewport.height - viewport.offsetTop : 0;
      dialog.style.setProperty("--sheet-covered", `${Math.max(0, Math.round(covered))}px`);
    };
    fit();
    viewport?.addEventListener("resize", fit);
    dialog.showModal();
    dialog.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    return () => {
      viewport?.removeEventListener("resize", fit);
      opener?.focus();
    };
  }

  function ask(event: Event) {
    event.preventDefault();
    onclose();
  }
</script>

<dialog
  class="sheet"
  aria-label={label}
  {@attach modal}
  oncancel={ask}
  onkeydown={(event) => event.key === "Escape" && ask(event)}
  onclick={(event) => event.target === event.currentTarget && onclose()}
>
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

    &::backdrop {
      background: rgb(var(--clr-shade-rgb) / 0.6);
    }
  }

  .sheet-body {
    min-width: 0;
  }
</style>
