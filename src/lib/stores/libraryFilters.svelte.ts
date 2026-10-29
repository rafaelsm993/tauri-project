import type { LibraryViewMode } from "$lib/domain/libraryView";
import type { StatusFilter } from "$lib/domain/libraryView";
import type { MediaType } from "$lib/types/media";

// Library screen filters; kept for the session so they survive opening a card.
export class LibraryFilters {
  status = $state<StatusFilter>("all");
  // Empty means every type.
  types = $state<MediaType[]>([]);
  query = $state("");
  view = $state<LibraryViewMode>("grid");
}

export const libraryFilters = new LibraryFilters();
