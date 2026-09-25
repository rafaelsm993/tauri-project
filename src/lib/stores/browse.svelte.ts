import { catalog as defaultCatalog, type Catalog } from "$lib/api/catalog";
import { errorMessage } from "$lib/utils/errors";
import { GENRE_SUPPORTED } from "$lib/types/media";
import type { GenreId, GenreOption, MediaItem, MediaType } from "$lib/types/media";

// Keeps the first occurrence of each media_key; providers repeat items across pages.
function uniqueByKey(items: MediaItem[], existing: MediaItem[] = []): MediaItem[] {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch set
  const seen = new Set(existing.map((it) => it.media_key));
  return items.filter((it) => !seen.has(it.media_key) && !!seen.add(it.media_key));
}

export type GenreSection = {
  genre: GenreOption;
  items: MediaItem[];
  loading: boolean;
  error: string;
};

// Home screen state; one instance per page mount.
export class BrowseStore {
  activeCategory = $state<MediaType>("movie");
  query = $state("");
  isSearch = $state(false);
  error = $state("");

  items = $state<MediaItem[]>([]);
  page = $state(1);
  totalPages = $state(1);
  loading = $state(false);
  appending = $state(false);

  sections = $state<GenreSection[]>([]);

  genres = $state<GenreOption[]>([]);
  activeGenre = $state<GenreId | null>(null);
  genresLoading = $state(false);
  // Empty means show all carousels.
  selectedGenres = $state<GenreId[]>([]);

  carouselMode = $derived(!this.isSearch && this.activeGenre === null);
  // Carousel mode falls back to the flat grid when no genre list could be loaded.
  gridMode = $derived(!this.carouselMode || (this.sections.length === 0 && !this.genresLoading));
  genreOptions = $derived(this.genres.map((g) => ({ value: g.id, label: g.name })));
  visibleSections = $derived(
    this.selectedGenres.length === 0
      ? this.sections
      : this.sections.filter((s) => this.selectedGenres.includes(s.genre.id)),
  );
  hasMore = $derived(this.page < this.totalPages && !this.error);

  #catalog: Catalog;
  // Per-category cache, deliberately not reactive.
  #genreCache: Partial<Record<MediaType, GenreOption[]>> = {};
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- not UI state
  #requested = new Set<GenreId>();

  constructor(catalog: Catalog = defaultCatalog) {
    this.#catalog = catalog;
  }

  async refreshGenres(cat: MediaType): Promise<GenreOption[]> {
    if (!GENRE_SUPPORTED.has(cat)) {
      this.genres = [];
      return [];
    }
    const cached = this.#genreCache[cat];
    if (cached) {
      this.genres = cached;
      return cached;
    }
    this.genresLoading = true;
    try {
      const list = await this.#catalog.fetchGenres(cat);
      this.#genreCache[cat] = list;
      this.genres = list;
      return list;
    } catch {
      this.genres = [];
      return [];
    } finally {
      this.genresLoading = false;
    }
  }

  // Sections load lazily on scroll to respect rate limits (AniList 90/min, iTunes ~20/min).
  loadCarousels(list: GenreOption[]) {
    this.#requested.clear();
    this.sections = list.map((genre) => ({ genre, items: [], loading: true, error: "" }));
  }

  // Idempotent per carousel load; results from a stale category are dropped.
  async loadSection(id: GenreId) {
    if (this.#requested.has(id)) return;
    const cat = this.activeCategory;
    const idx = this.sections.findIndex((s) => s.genre.id === id);
    if (idx === -1) return;
    this.#requested.add(id);
    const sections = this.sections;
    try {
      const res = await this.#catalog.fetchPage(cat, "", 1, id);
      if (this.activeCategory !== cat || this.sections !== sections) return;
      this.sections[idx] = {
        ...this.sections[idx],
        items: uniqueByKey(res.results),
        loading: false,
      };
    } catch (e) {
      if (this.activeCategory !== cat || this.sections !== sections) return;
      this.sections[idx] = {
        ...this.sections[idx],
        loading: false,
        error: errorMessage(e, "Error."),
      };
    }
  }

  retrySection(id: GenreId) {
    const idx = this.sections.findIndex((s) => s.genre.id === id);
    if (idx === -1) return;
    this.#requested.delete(id);
    this.sections[idx] = { ...this.sections[idx], loading: true, error: "" };
    return this.loadSection(id);
  }

  // After reconnecting: redo whatever failed, leave what loaded alone.
  async retryFailed() {
    if (this.error) {
      await (this.carouselMode ? this.refreshView() : this.loadGrid(this.query));
      return;
    }
    const failed = this.sections.filter((s) => s.error).map((s) => s.genre.id);
    await Promise.all(failed.map((id) => this.retrySection(id)));
  }

  setSelectedGenres(ids: GenreId[]) {
    this.selectedGenres = ids;
  }

  async loadGrid(newQuery = this.query) {
    if (this.loading) return;
    this.query = newQuery;
    this.isSearch = !!newQuery.trim();
    this.page = 1;
    this.items = [];
    this.error = "";
    this.loading = true;
    try {
      const res = await this.#catalog.fetchPage(this.activeCategory, newQuery, 1, this.activeGenre);
      this.items = uniqueByKey(res.results);
      this.totalPages = res.total_pages ?? 1;
    } catch (e) {
      this.error = errorMessage(e, "Failed to fetch data.");
    } finally {
      this.loading = false;
    }
  }

  async loadMore() {
    if (this.appending || !this.hasMore || this.carouselMode) return;
    this.appending = true;
    const items = this.items;
    try {
      const next = this.page + 1;
      const res = await this.#catalog.fetchPage(
        this.activeCategory,
        this.query,
        next,
        this.activeGenre,
      );
      if (this.items !== items) return;
      const fresh = uniqueByKey(res.results, items);
      if (fresh.length === 0) {
        this.totalPages = this.page;
        return;
      }
      this.items = [...items, ...fresh];
      this.page = next;
    } catch (e) {
      if (this.items === items) this.error = errorMessage(e, "Failed to load more.");
    } finally {
      this.appending = false;
    }
  }

  async refreshView() {
    this.error = "";
    if (this.carouselMode) {
      const list = await this.refreshGenres(this.activeCategory);
      if (!GENRE_SUPPORTED.has(this.activeCategory) || list.length === 0) {
        this.sections = [];
        await this.loadGrid("");
        return;
      }
      this.items = [];
      this.loading = false;
      this.loadCarousels(list);
    } else {
      this.sections = [];
      await this.loadGrid(this.query);
    }
  }

  search(q: string) {
    this.query = q;
    this.isSearch = !!q.trim();
    if (this.isSearch) {
      this.activeGenre = null;
      return this.loadGrid(q);
    }
    return this.refreshView();
  }

  clearSearch() {
    this.query = "";
    this.isSearch = false;
    return this.refreshView();
  }

  async switchCategory(cat: MediaType) {
    if (cat === this.activeCategory && !this.loading) return;
    this.activeCategory = cat;
    this.activeGenre = null;
    this.selectedGenres = [];
    await this.refreshGenres(cat);
    await this.refreshView();
  }

  async switchGenre(id: GenreId | null) {
    if (id === this.activeGenre) return;
    this.activeGenre = id;
    await this.refreshView();
  }
}
