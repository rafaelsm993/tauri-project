<script lang="ts">
  // One-line context above the results: search term, selected genre, or default.
  let { isSearch, query, genreName, onClearSearch, onAllGenres } = $props<{
    isSearch: boolean;
    query: string;
    genreName: string | null;
    onClearSearch: () => void;
    onAllGenres: () => void;
  }>();
</script>

<p class="page-context">
  {#if isSearch}
    Results for <strong>"{query}"</strong>
    <button class="link-btn" onclick={onClearSearch}>← Discover</button>
  {:else if genreName !== null}
    Populares em <strong>{genreName}</strong>
    <button class="link-btn" onclick={onAllGenres}> ← All genres </button>
  {:else}
    Browse by genre
  {/if}
</p>

<style lang="scss">
  .page-context {
    font-size: 0.78rem;
    color: var(--clr-text-3);
    letter-spacing: 0.06em;
    text-transform: uppercase;

    strong {
      color: var(--clr-text-2);
      font-weight: 600;
      text-transform: none;
    }
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--clr-primary);
    font-size: 0.78rem;
    cursor: pointer;
    margin-left: $spacing-sm;
    padding: 0;
    text-decoration: underline;
    &:hover {
      color: var(--clr-text);
    }
  }
</style>
