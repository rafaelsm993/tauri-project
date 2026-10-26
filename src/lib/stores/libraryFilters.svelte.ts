import type { LibraryViewMode } from "$lib/domain/libraryView";
import type { StatusFilter, TypeFilter } from "$lib/domain/libraryView";

// Library screen filters; kept for the session so they survive opening a card.
export class LibraryFilters {
  status = $state<StatusFilter>("all");
  type = $state<TypeFilter>("all");
  query = $state("");
  view = $state<LibraryViewMode>("grid");
}

export const libraryFilters = new LibraryFilters();
