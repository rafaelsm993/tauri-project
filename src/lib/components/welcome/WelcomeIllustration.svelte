<script lang="ts">
  import RunicTreeMap from "$lib/components/progression/RunicTreeMap.svelte";
  import PlanSheet from "$lib/components/library/PlanSheet.svelte";
  import LengthFields from "$lib/components/library/LengthFields.svelte";
  import SessionPicker from "$lib/components/library/SessionPicker.svelte";
  import MatchCompare from "$lib/components/reconcile/MatchCompare.svelte";
  import { journeyNodes } from "$lib/domain/progressionTree";
  import { emptyLength } from "$lib/domain/length";
  import { sessionScale, type SessionChoice } from "$lib/domain/sessionScale";
  import type { LibraryEntry, Length } from "$lib/types/library";
  import type { MediaItem } from "$lib/types/media";
  import type { Beat } from "$lib/domain/welcome";
  let { beat }: { beat: Exclude<Beat, "keys"> } = $props();
  const book: LibraryEntry = {
    key: "manual:book:00000000-0000-4000-8000-000000000001",
    snapshot: {
      media_key: "manual:book:00000000-0000-4000-8000-000000000001",
      provider: "manual",
      media_type: "book",
      title: "Example reading journal",
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status: "in_progress",
      progress: 40,
      rating: null,
      review: null,
      length: { ...emptyLength(), pages: 200 },
      plan: { days: [0, 2, 4], max_session_minutes: 60, since: "2026-10-01" },
    },
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
  };
  const tree = journeyNodes(
    [{ ...book, user: { ...book.user, status: "completed", progress: 200 } }],
    3,
    "book",
  );
  let pages = $state<Length>({ ...emptyLength(), pages: 200 });
  let chapters = $state<Length>({ ...emptyLength(), chapter_minutes: 5 });
  let choice = $state<SessionChoice>({ count: 2, custom: false, typed: 60 });
  const scale = sessionScale(book, 60)!;
  const item: MediaItem = {
    id: "123456",
    provider: "itunes",
    media_type: "book",
    media_key: "itunes:book:123456",
    title: "Example catalog edition",
    overview: "Example only",
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
  };
  const merged: LibraryEntry = {
    ...book,
    key: item.media_key,
    snapshot: {
      ...book.snapshot,
      media_key: item.media_key,
      provider: "itunes",
      title: item.title,
    },
  };
</script>

<figure class="tutorial-example">
  <figcaption>Example — preview only; nothing here changes your library.</figcaption>
  <div class="preview" role="img" aria-label="{beat} example — preview only">
    <div inert aria-hidden="true">
      {#if beat === "garden"}
        <RunicTreeMap nodes={tree} media rootArt="book:1" onselect={() => {}} />
      {:else if beat === "planner"}
        <PlanSheet
          entry={book}
          today="2026-10-01"
          pagesPerHour={60}
          busy
          onsave={() => {}}
          onclear={() => {}}
          oncancel={() => {}}
        />
      {:else if beat === "pace"}
        <p class="example-label">Book · 60 pages per hour</p>
        <LengthFields fields={["pages"]} bind:length={pages} mediaType="book" disabled />
        <SessionPicker
          {scale}
          bind:choice
          label="Example reading session"
          pagesPerHour={60}
          disabled
        />
        <p class="example-label">Manga · minutes per chapter</p>
        <LengthFields
          fields={["chapter_minutes"]}
          bind:length={chapters}
          mediaType="manga"
          disabled
        />
      {:else}
        <MatchCompare {item} mine={book} {merged} combined={false} posterDir={null} />
      {/if}
    </div>
  </div>
</figure>

<style lang="scss">
  .tutorial-example {
    margin: 0;
    display: grid;
    gap: $spacing-sm;
    min-width: 0;
  }
  figcaption {
    font-size: 0.8rem;
    color: var(--clr-text-3);
  }
  .preview {
    padding: $spacing-md;
    border: 1px solid var(--clr-border);
    border-radius: $radius-lg;
    background: var(--clr-surface);
    min-width: 0;
  }
  .preview > div {
    display: grid;
    gap: $spacing-sm;
    min-width: 0;
  }
  .example-label {
    font-weight: 600;
    color: var(--clr-text);
  }
</style>
