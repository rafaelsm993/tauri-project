<script lang="ts">
  import { motionStore } from "$lib/stores/motion.svelte";
  import { unlocksStore } from "$lib/stores/unlocks.svelte";
  import type { LibraryEntry } from "$lib/types/library";
  import type { MediaType } from "$lib/types/media";
  const MEDIA_LABELS: Record<MediaType, string> = {
    movie: "Movies",
    tv: "TV",
    anime: "Anime",
    manga: "Manga",
    book: "Books",
    game: "Games",
  };
  import { COMPLETION_TYPES, completionAchievements } from "$lib/domain/completionAchievements";
  import { journeyNodes, treeBranches, type TreeMapNode } from "$lib/domain/progressionTree";
  import { detailPath } from "$lib/domain/libraryView";
  import { resolve } from "$app/paths";
  import { STATUS_LABELS } from "$lib/stores/library.svelte";
  import RunicTreeMap from "./RunicTreeMap.svelte";
  import type { UnlockKind } from "$lib/domain/unlocks";
  import BranchSheet from "./BranchSheet.svelte";
  import RewardSheet from "./RewardSheet.svelte";
  import { tick, untrack } from "svelte";
  import { page } from "$app/state";
  import { pushState } from "$app/navigation";

  let {
    entries,
    allEntries,
    currentLevel,
    loaded = false,
    error = "",
    onclear,
    motion,
    shimmer,
  }: {
    entries: LibraryEntry[];
    allEntries: LibraryEntry[];
    currentLevel: number | null;
    loaded?: boolean;
    error?: string;
    onclear?: () => void;
    motion?: boolean;
    shimmer?: boolean;
  } = $props();
  const id = $props.id();
  const selected = $derived(page.state.runewood?.tree === id ? page.state.runewood.media : null);
  let genrePage = $state(0);
  let openBranch = $state<{ id: string; label: string } | null>(null);
  let openReward = $state<{ kind: UnlockKind | "title" | "art"; id: string } | null>(null);
  const available = $derived(loaded && currentLevel !== null && !error);
  const shines = $derived(
    available &&
      (currentLevel ?? 0) >= 8 &&
      (motion ?? motionStore.on) &&
      (shimmer ?? unlocksStore.garden === "sway"),
  );
  const rewards = $derived(completionAchievements(allEntries, currentLevel ?? 0));
  const canonical = $derived(new Map(allEntries.map((entry) => [entry.key, entry])));
  const visible = $derived(
    treeBranches(entries.flatMap((entry) => canonical.get(entry.key) ?? [])),
  );
  const branch = $derived(visible.find((group) => group.type === selected));
  const branchPage = $derived(
    Math.min(genrePage, Math.max(0, Math.ceil((branch?.genres.length ?? 0) / 6) - 1)),
  );
  const genres = $derived(branch?.genres.slice(branchPage * 6, (branchPage + 1) * 6) ?? []);
  const activeBranch = $derived(
    openBranch
      ? (branch?.genres.find((genre) => genre.id === openBranch?.id) ?? {
          ...openBranch,
          members: [],
        })
      : null,
  );
  const selectedRewards = $derived(rewards.filter((reward) => reward.type === selected));
  async function selectMedia(type: MediaType) {
    pushState("", { ...page.state, runewood: { tree: id, media: type } });
    genrePage = 0;
    await tick();
    const heading = document.getElementById(`${id}-heading`);
    heading?.focus({ preventScroll: true });
    heading?.closest("header")?.scrollIntoView({ block: "start", behavior: "instant" });
    globalThis.scrollBy({
      top:
        -Math.max(
          0,
          document.querySelector(".app-header.sticky")?.getBoundingClientRect().bottom ?? 0,
        ) - 8,
      behavior: "instant",
    });
  }
  let previousMedia: MediaType | null = null;
  $effect(() => {
    const media = selected;
    if (media === previousMedia) return;
    const previous = previousMedia;
    previousMedia = media;
    untrack(() => {
      void tick().then(() => {
        if (!media)
          document
            .getElementById(`${id}-tree`)
            ?.querySelector<HTMLElement>(`[data-node="${previous}"]`)
            ?.focus();
      });
    });
  });
  const mainPositions = [
    [25, 20],
    [75, 20],
    [25, 48],
    [75, 48],
    [25, 76],
    [75, 76],
  ] as const;
  const mapNodes: TreeMapNode[] = $derived(
    selected
      ? journeyNodes(allEntries, currentLevel ?? 0, selected)
      : COMPLETION_TYPES.map((type, index) => ({
          id: type,
          art: `${type}:1`,
          label: MEDIA_LABELS[type],
          title: MEDIA_LABELS[type],
          caption: `${rewards.find((reward) => reward.type === type)?.count ?? 0} completed`,
          x: mainPositions[index][0],
          y: mainPositions[index][1],
        })),
  );
</script>

<div id="{id}-tree" class="progression-tree" class:shimmer={shines}>
  {#if !available}
    <p role="status" aria-label="Tree availability">
      {error ? `Progression unavailable: ${error}` : "Loading progression…"}
    </p>
  {:else}
    <section
      class:main-tree={!selected}
      class:media-detail={!!selected}
      aria-label={selected ? `${MEDIA_LABELS[selected]} subtree` : "Main progression tree"}
    >
      <header class="tree-heading">
        {#if selected}<button type="button" onclick={() => history.back()}>All media</button
          >{:else}<p class="eyebrow">THE SHARED ROOT</p>{/if}
        <h2 id="{id}-heading" tabindex="-1">
          {selected ? MEDIA_LABELS[selected] : "JOURNEY TREE"}
        </h2>
        <p>
          {selected
            ? `${selectedRewards[0]?.count ?? 0} completed · Tap a seal to preview its requirements`
            : "Six paths. One growing story."}
        </p>
        <span class="level-caption">Current level {currentLevel}</span>
      </header>
      <RunicTreeMap
        nodes={mapNodes}
        media={!!selected}
        reveal={shines}
        rootArt={selected ? `${selected}:1` : undefined}
        onselect={(key) => {
          if (!selected) {
            void selectMedia(key as MediaType);
            return;
          }
          const node = mapNodes.find((node) => node.id === key);
          if (node?.kind && node.rewardId) openReward = { kind: node.kind, id: node.rewardId };
        }}
      />
      {#if selected}
        <details class="exploration">
          <summary>Genres &amp; saved items</summary>
          {#if !branch}
            <p>
              {allEntries.some((entry) => entry.snapshot.media_type === selected)
                ? `No ${MEDIA_LABELS[selected].toLowerCase()} match the current filters.`
                : `No saved ${MEDIA_LABELS[selected].toLowerCase()} yet.`}
            </p>
            {#if onclear && allEntries.some((entry) => entry.snapshot.media_type === selected)}
              <button type="button" onclick={onclear}>Clear tree filters</button>
            {/if}
          {:else}
            <div class="genre-branches">
              {#each genres as genre (genre.id)}
                <section class="genre" aria-label={genre.label}>
                  <h3>{genre.label} · {genre.members.length}</h3>
                  <button
                    type="button"
                    class="branch-open"
                    aria-label="Open {genre.label} branch"
                    onclick={() => (openBranch = { id: genre.id, label: genre.label })}
                    >Explore all {genre.members.length}</button
                  >
                  {#each genre.members.slice(0, 6) as entry (entry.key)}
                    {@const path = detailPath(entry)}
                    <a
                      class="leaf"
                      aria-label="{entry.snapshot.title} {STATUS_LABELS[entry.user.status]}"
                      href={resolve("/media/[type]/[id]", {
                        type: path.type,
                        id: encodeURIComponent(path.id),
                      })}
                    >
                      <span>{entry.snapshot.title}</span>&nbsp;<small
                        >{STATUS_LABELS[entry.user.status]}</small
                      >
                    </a>
                  {/each}
                </section>
              {/each}
            </div>
            <nav class="branch-controls" aria-label="Genre pages">
              <button
                type="button"
                disabled={branchPage === 0}
                onclick={() => (genrePage = branchPage - 1)}>Previous branches</button
              >
              <p>
                Branches {branchPage * 6 + 1}–{Math.min((branchPage + 1) * 6, branch.genres.length)} of
                {branch.genres.length}
              </p>
              <button
                type="button"
                disabled={(branchPage + 1) * 6 >= branch.genres.length}
                onclick={() => (genrePage = branchPage + 1)}>Next branches</button
              >
            </nav>
          {/if}
        </details>
      {/if}
    </section>
    {#if activeBranch}<BranchSheet branch={activeBranch} onclose={() => (openBranch = null)} />{/if}
    {#if openReward}<RewardSheet
        kind={openReward.kind}
        rewardId={openReward.id}
        entries={allEntries}
        {currentLevel}
        onclose={() => (openReward = null)}
      />{/if}
  {/if}
</div>

<style lang="scss">
  .progression-tree {
    --bark: color-mix(in srgb, var(--clr-accent) 24%, var(--clr-surface));
    --bark-light: color-mix(in srgb, var(--clr-accent) 46%, var(--clr-surface));
    --rune-wash: rgb(var(--clr-accent-rgb) / 0.08);
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
    min-width: 0;
    width: 100%;
    color: var(--clr-text);
  }
  .main-tree,
  .media-detail {
    min-width: 0;
    padding: $spacing-md;
    background: var(--clr-surface);
    border: 1px solid var(--clr-border);
    border-radius: $radius-sm;
  }
  .main-tree {
    background: linear-gradient(var(--rune-wash), transparent 24rem), var(--clr-surface);
  }
  .tree-heading {
    text-align: center;
  }
  .eyebrow {
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    color: var(--clr-text-2);
  }
  h2 {
    font-size: 1.4rem;
    font-weight: 600;
  }
  .tree-heading h2 {
    font-family: $font-display;
    font-size: 2.2rem;
    letter-spacing: 0.04em;
  }
  p {
    color: var(--clr-text-2);
    font-size: 0.8rem;
  }
  .level-caption {
    display: inline-block;
    padding: $spacing-xs $spacing-sm;
    margin-top: $spacing-sm;
    font-size: 0.75rem;
    background: var(--rune-wash);
    border: 1px solid var(--bark-light);
  }
  .branch-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: $spacing-xs;
    margin-block: $spacing-sm;
  }
  button,
  summary,
  h2 {
    scroll-margin-block: 6rem;
  }
  button {
    min-height: $touch-target;
    min-width: $touch-target;
    padding: $spacing-xs $spacing-sm;
    font: inherit;
    font-size: 0.75rem;
    background: var(--clr-bg);
    color: var(--clr-text);
    border: 1px solid var(--clr-border-2);
    cursor: pointer;
  }
  button:disabled {
    color: var(--clr-text-3);
    cursor: not-allowed;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--clr-accent);
    outline-offset: 2px;
  }
  .genre-branches {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-md;
  }
  .genre {
    min-width: 0;
    padding: $spacing-sm;
    border-inline-start: 4px solid var(--bark);
    background: var(--clr-bg);
  }
  .genre h3 {
    font-size: 0.85rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .branch-open {
    margin-block: $spacing-xs;
  }
  .leaf {
    min-height: $touch-target;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-xs;
    padding: $spacing-xs;
    margin-block: $spacing-xs;
    color: var(--clr-text);
    border-inline-start: 2px solid var(--bark-light);
    overflow-wrap: anywhere;
  }
  .leaf span {
    min-width: 0;
    font-size: 0.8rem;
  }
  .leaf small {
    color: var(--clr-text-2);
    font-size: 0.65rem;
  }
  @include hover-capable {
    button:hover:not(:disabled),
    .leaf:hover {
      background: var(--rune-wash);
    }
  }
  .exploration {
    margin-top: $spacing-md;
  }
  summary {
    display: list-item;
    min-height: $touch-target;
    padding: $spacing-sm;
    cursor: pointer;
    color: var(--clr-text-2);
    font-size: 0.8rem;
    border: 1px solid var(--clr-border);
  }
  summary:focus-visible {
    outline: 2px solid var(--clr-accent);
    outline-offset: 2px;
  }
  .tree-heading h2:focus {
    outline: none;
  }
  @include respond-to(md) {
    .genre-branches {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
