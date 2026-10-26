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
  import { levelWindow, treeBranches } from "$lib/domain/progressionTree";
  import { detailPath } from "$lib/domain/libraryView";
  import { resolve } from "$app/paths";
  import { STATUS_LABELS } from "$lib/stores/library.svelte";
  import ProfileArtwork from "$lib/components/profile/ProfileArtwork.svelte";
  import type { UnlockKind } from "$lib/domain/unlocks";
  import BranchSheet from "./BranchSheet.svelte";
  import RewardSheet from "./RewardSheet.svelte";
  import SegmentedControl from "$lib/components/ui/SegmentedControl.svelte";

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
  let selected = $state<MediaType>("movie");
  let levelPage = $state<number | null>(null);
  const window = $derived(
    levelWindow(currentLevel ?? 1, levelPage ?? Math.floor(((currentLevel ?? 1) - 1) / 10)),
  );
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
  const options = COMPLETION_TYPES.map((type) => ({ value: type, label: MEDIA_LABELS[type] }));
</script>

<div class="progression-tree" class:shimmer={shines}>
  {#if !available}
    <p role="status" aria-label="Tree availability">
      {error ? `Progression unavailable: ${error}` : "Loading progression…"}
    </p>
  {:else}
    <section class="main-tree" aria-label="Main progression tree">
      <header class="tree-heading">
        <p class="eyebrow">THE SHARED ROOT</p>
        <h2>Runewood</h2>
        <p>Six paths. One growing story.</p>
        <span class="level-caption">Current level {currentLevel}</span>
      </header>
      <svg
        class="tree-crown"
        aria-hidden="true"
        width="288"
        height="96"
        viewBox="0 0 96 32"
        shape-rendering="crispEdges"
      >
        <path
          class="bark"
          d="M40 32H59V29H55V25H53V20H58V18H65V15H72V13H79V10H86V7H91V2H88V5H83V8H77V10H69V13H62V16H54V12H57V8H60V2H57V6H53V10H50V7H47V3H44V9H47V14H44V18H39V15H31V12H23V9H16V5H12V1H8V6H11V10H19V13H26V16H33V20H40V23H43V28H40Z"
        />
        <path
          class="bark-light"
          d="M45 31H50V25H48V20H44V19H38V17H30V14H22V11H15V8H12V6H14V9H21V12H29V15H37V17H45V14H47V19H52V17H61V14H68V12H76V9H83V7H87V6H89V8H85V10H79V12H72V15H65V17H58V20H52V24H50V29H52V31Z"
        />
        <path
          class="rune"
          d="M45 22h3v2h-1v3h-1v-3h-1z M32 15h3v1h-1v2h-1v-2h-1z M65 13h3v1h-1v2h-1v-2h-1z M8 0h3v2H8z M57 0h3v2h-3z M88 0h3v2h-3z"
        />
      </svg>
      <div class="media-arms">
        {#each COMPLETION_TYPES as type (type)}
          <div class="media-arm" role="group" aria-label={MEDIA_LABELS[type]}>
            <ProfileArtwork art={`${type}:1`} size={32} decorative />
            <h3>{MEDIA_LABELS[type]}</h3>
            <p>{rewards.find((reward) => reward.type === type)?.count ?? 0} completed</p>
          </div>
        {/each}
      </div>
      <div class="level-controls" role="group" aria-label="Level pages">
        <button
          type="button"
          disabled={window.page === 0}
          onclick={() => (levelPage = window.page - 1)}>Earlier levels</button
        >
        <p>Levels {window.start}–{window.end}</p>
        <button
          type="button"
          disabled={window.page === window.pages - 1}
          onclick={() => (levelPage = window.page + 1)}>Later levels</button
        >
        <button
          type="button"
          onclick={() => (levelPage = Math.floor(((currentLevel ?? 1) - 1) / 10))}
          >Current level</button
        >
      </div>
      <ol class="level-spine" aria-label="Level progression">
        {#each window.rows as row (row.level)}
          <li class:earned={row.unlocked} class:current={row.current}>
            <span
              aria-label={row.current ? `Current level ${row.level}` : `Level ${row.level}`}
              aria-current={row.current ? "step" : undefined}>{row.level}</span
            >
            <div>
              {#each row.titles as title (title.name)}<button
                  type="button"
                  aria-label="Preview title {title.name}"
                  onclick={() => (openReward = { kind: "title", id: title.name })}
                  >{title.name}</button
                >{/each}
              {#each row.rewards as reward (reward.id)}
                <button
                  type="button"
                  aria-label="Preview {reward.label}"
                  onclick={() => (openReward = { kind: reward.kind, id: reward.id })}
                  >{reward.label}</button
                >
              {/each}
              {#if !row.titles.length && !row.rewards.length}<span
                  >{row.unlocked ? "Earned growth" : "Growth ahead"}</span
                >{/if}
            </div>
          </li>
        {/each}
      </ol>
      <p class="root">Root · Every story leaves a mark</p>
    </section>
    <SegmentedControl
      label="Explore media trees"
      controls={`${id}-detail`}
      {options}
      value={selected}
      onchange={(type) => {
        selected = type;
        genrePage = 0;
        openBranch = null;
      }}
    />
    <section id="{id}-detail" class="media-detail" aria-label="{MEDIA_LABELS[selected]} subtree">
      <h2>{MEDIA_LABELS[selected]}</h2>
      <div class="milestones" role="group" aria-label="Completion milestones">
        {#each selectedRewards as reward (reward.id)}
          <button
            type="button"
            class="milestone"
            class:earned={reward.unlocked}
            aria-label="Preview {reward.name} tier {reward.tier}"
            onclick={() => (openReward = { kind: "art", id: reward.id })}
          >
            <ProfileArtwork art={reward.id} size={32} decorative />
            <strong>{reward.required} completed</strong>
            <span>{reward.count} / {reward.required} · Level {reward.level}</span>
            <span>{reward.unlocked ? "Available" : "Requirements not met"}</span>
          </button>
        {/each}
      </div>
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
            Branches {branchPage * 6 + 1}–{Math.min((branchPage + 1) * 6, branch.genres.length)} of {branch
              .genres.length}
          </p>
          <button
            type="button"
            disabled={(branchPage + 1) * 6 >= branch.genres.length}
            onclick={() => (genrePage = branchPage + 1)}>Next branches</button
          >
        </nav>
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
  .shimmer .rune {
    animation: runic-reveal 600ms ease-out 1;
  }
  @keyframes runic-reveal {
    0% {
      opacity: 0.25;
    }
    55% {
      opacity: 1;
    }
    100% {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .shimmer .rune {
      animation: none;
    }
  }
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
  .tree-crown {
    display: block;
    max-width: 100%;
    height: auto;
    margin: $spacing-sm auto 0;
  }
  .bark {
    fill: var(--bark);
  }
  .bark-light {
    fill: var(--bark-light);
  }
  .rune {
    fill: var(--clr-accent);
  }
  .media-arms {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: $spacing-sm;
    position: relative;
    padding-block: $spacing-sm $spacing-md;
  }
  .media-arm {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-xs;
    position: relative;
    padding: $spacing-sm $spacing-xs;
    text-align: center;
    border: 2px solid var(--bark);
    background: var(--clr-bg);
    clip-path: polygon(
      4px 0,
      calc(100% - 4px) 0,
      calc(100% - 4px) 4px,
      100% 4px,
      100% calc(100% - 4px),
      calc(100% - 4px) calc(100% - 4px),
      calc(100% - 4px) 100%,
      4px 100%,
      4px calc(100% - 4px),
      0 calc(100% - 4px),
      0 4px,
      4px 4px
    );
    h3 {
      font-size: 0.8rem;
      font-weight: 600;
    }
    p {
      font-size: 0.7rem;
    }
  }
  .progression-tree :global(.segmented .segment) {
    min-height: $touch-target;
    min-width: $touch-target;
  }
  .level-controls,
  .branch-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: $spacing-xs;
    margin-block: $spacing-sm;
  }
  .level-controls p {
    order: -1;
    flex-basis: 100%;
    text-align: center;
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
  .level-spine {
    list-style: none;
    position: relative;
    padding: $spacing-sm 0;
    margin: 0;
    display: grid;
    gap: $spacing-xs;
  }
  .level-spine::before {
    content: "";
    position: absolute;
    inset-block: 0;
    left: 22px;
    width: 12px;
    background:
      repeating-linear-gradient(0deg, transparent 0 12px, var(--bark-light) 12px 16px), var(--bark);
    border-inline: 2px solid var(--bark-light);
  }
  .level-spine li {
    position: relative;
    display: flex;
    gap: $spacing-md;
    align-items: center;
    min-height: $touch-target;
  }
  .level-spine li > span {
    flex: 0 0 44px;
    display: grid;
    place-items: center;
    height: 44px;
    font-size: 0.85rem;
    font-weight: 600;
    background: var(--clr-surface);
    color: var(--clr-text-2);
    border: 2px solid var(--clr-border-2);
    box-shadow: 3px 3px 0 var(--clr-bg);
  }
  .level-spine li.earned > span {
    border-color: var(--bark-light);
    color: var(--clr-text);
  }
  .level-spine li.current > span {
    background: var(--clr-primary);
    color: var(--clr-on-primary);
    border-color: var(--clr-accent);
  }
  .level-spine li > div {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-xs;
  }
  .level-spine li > div > span {
    font-size: 0.7rem;
    color: var(--clr-text-2);
  }
  .level-spine li > div button {
    border-style: dashed;
  }
  .level-spine li.earned > div button {
    border-style: solid;
    background: var(--rune-wash);
  }
  .root {
    padding: $spacing-md 0;
    border-top: 4px double var(--bark-light);
    text-align: center;
    font-size: 0.7rem;
  }
  .media-detail {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }
  .media-detail h2 {
    font-size: 1.15rem;
  }
  .milestones {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: $spacing-sm;
  }
  .milestone {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-xs;
    text-align: center;
    border: 2px dashed var(--clr-border-2);
  }
  .milestone span {
    font-size: 0.65rem;
    color: var(--clr-text-2);
  }
  .milestone strong {
    font-weight: 600;
  }
  .milestone.earned {
    border: 2px solid var(--bark-light);
    background: var(--rune-wash);
  }
  .milestone:not(.earned) :global(.profile-artwork) {
    opacity: 0.55;
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
  @include respond-to(md) {
    .media-arms {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .milestones {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .genre-branches {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
