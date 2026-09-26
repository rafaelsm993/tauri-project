<script lang="ts">
  import type { StartupProblem } from "$lib/types/startup";

  let { problem }: { problem: StartupProblem } = $props();

  let copied = $state(false);

  async function copyPath() {
    await navigator.clipboard.writeText(problem.dir);
    copied = true;
  }
</script>

<main class="startup">
  <h1 class="startup-title">Your library could not be opened</h1>

  {#if problem.kind === "newer"}
    <p>
      {problem.file} was saved by a newer version of Aevum than this one. To keep your data safe, this
      version will not open or change it. Please update Aevum and open it again.
    </p>
  {:else}
    <p>
      {problem.file} could not be read by this version of Aevum. Nothing was changed or deleted. If you
      have a backup, move this folder somewhere else to start fresh, then import the backup from Settings.
    </p>
  {/if}

  <section class="startup-folder" aria-labelledby="folder-title">
    <h2 id="folder-title" class="startup-label">Data folder</h2>
    <code class="startup-path">{problem.dir}</code>
    <div class="startup-actions">
      <button type="button" class="btn" onclick={copyPath}>Copy folder path</button>
      {#if copied}
        <span class="startup-copied" role="status">Copied.</span>
      {/if}
    </div>
  </section>

  <details class="startup-detail">
    <summary>Technical detail</summary>
    <code class="startup-path">{problem.detail}</code>
  </details>
</main>

<style lang="scss">
  .startup {
    @include page-shell;
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
    max-width: 48rem;
    color: var(--clr-text-2);
  }

  .startup-title {
    @include page-title;
    color: var(--clr-text);
  }

  .startup-folder {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    padding: $spacing-md;
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
    background: var(--clr-surface);
    min-width: 0;
  }

  .startup-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--clr-text);
  }

  .startup-path {
    font-family: $font-mono;
    font-size: 0.8rem;
    color: var(--clr-text);
    overflow-wrap: anywhere;
  }

  .startup-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-sm;
  }

  .btn {
    padding: $spacing-xs $spacing-md;
    border: 1px solid var(--clr-border-2);
    border-radius: $radius-full;
    background: none;
    color: var(--clr-text);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--clr-accent);
      outline-offset: 2px;
    }

    @include hover-capable {
      &:hover {
        border-color: var(--clr-accent);
      }
    }

    @include touch {
      min-height: $touch-target;
    }
  }

  .startup-copied {
    font-size: 0.85rem;
    color: var(--clr-teal);
  }

  .startup-detail {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    font-size: 0.85rem;

    summary {
      cursor: pointer;

      @include touch {
        min-height: $touch-target;
        display: flex;
        align-items: center;
      }
    }
  }
</style>
