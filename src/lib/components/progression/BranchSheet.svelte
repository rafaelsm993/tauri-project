<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { detailPath } from "$lib/domain/libraryView";
  import type { GenreBranch } from "$lib/domain/progressionTree";
  import { STATUS_LABELS } from "$lib/stores/library.svelte";
  import Sheet from "$lib/components/ui/Sheet.svelte";

  let { branch, onclose }: { branch: GenreBranch; onclose: () => void } = $props();
  let requestedPage = $state(0);
  let destination = $state<ReturnType<typeof detailPath> | null>(null);
  const page = $derived(
    Math.min(requestedPage, Math.max(0, Math.ceil(branch.members.length / 30) - 1)),
  );
  const members = $derived(branch.members.slice(page * 30, (page + 1) * 30));
</script>

<Sheet
  label="{branch.label} branch"
  {onclose}
  focus="sheet"
  onclosed={() => {
    if (destination)
      void goto(
        resolve("/media/[type]/[id]", {
          type: destination.type,
          id: encodeURIComponent(destination.id),
        }),
      );
  }}
>
  <section class="branch-sheet">
    <header>
      <h2>{branch.label}</h2>
      <button type="button" onclick={onclose}>Close branch</button>
    </header>
    {#if members.length}
      <p>
        {page * 30 + 1}–{Math.min((page + 1) * 30, branch.members.length)} of {branch.members
          .length}
      </p>
      <ul>
        {#each members as entry (entry.key)}
          {@const path = detailPath(entry)}
          {@const href = resolve("/media/[type]/[id]", {
            type: path.type,
            id: encodeURIComponent(path.id),
          })}
          <li>
            <a
              {href}
              aria-label="{entry.snapshot.title} {STATUS_LABELS[entry.user.status]}"
              onclick={(event) => {
                if (
                  event.button === 0 &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  destination = path;
                  onclose();
                }
              }}
              ><span>{entry.snapshot.title}</span>&nbsp;<small
                >{STATUS_LABELS[entry.user.status]}</small
              ></a
            >
          </li>
        {/each}
      </ul>
      <nav aria-label="Branch item pages">
        <button type="button" disabled={page === 0} onclick={() => (requestedPage = page - 1)}
          >Previous items</button
        >
        <button
          type="button"
          disabled={(page + 1) * 30 >= branch.members.length}
          onclick={() => (requestedPage = page + 1)}>Next items</button
        >
      </nav>
    {:else}<p>No saved entries remain in this branch.</p>{/if}
  </section>
</Sheet>

<style lang="scss">
  .branch-sheet {
    width: min(36rem, 100%);
    min-width: 0;
    padding: $spacing-lg;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-md;
  }
  header,
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
  }
  h2 {
    font-size: 1.1rem;
    overflow-wrap: anywhere;
  }
  p {
    color: var(--clr-text-2);
    padding-block: $spacing-sm;
  }
  ul {
    list-style: none;
    padding: 0;
    display: grid;
    gap: $spacing-xs;
  }
  a {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: $spacing-sm;
    padding: $spacing-sm;
    min-height: $touch-target;
    color: var(--clr-text);
    background: var(--clr-bg);
    overflow-wrap: anywhere;
  }
  small {
    color: var(--clr-text-2);
  }
  button {
    min-height: $touch-target;
    padding: $spacing-sm;
    background: var(--clr-bg);
    color: var(--clr-text);
    border: 1px solid var(--clr-border);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--clr-accent);
    outline-offset: 2px;
  }
  nav {
    margin-top: $spacing-md;
  }
</style>
