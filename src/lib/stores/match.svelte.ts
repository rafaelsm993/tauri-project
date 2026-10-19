import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { detailPath } from "$lib/domain/libraryView";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaKey } from "$lib/types/media";

// A just-made match the toast can still undo.
export interface MatchNotice {
  manual: LibraryEntry;
  into: LibraryEntry;
}

type Unmerger = { unmerge: (key: MediaKey) => Promise<LibraryEntry | null>; error: string };

// The detail page this item lives on now; replaces the history entry so Back skips the old page.
function land(entry: LibraryEntry) {
  const path = detailPath(entry);
  void goto(resolve("/media/[type]/[id]", { type: path.type, id: encodeURIComponent(path.id) }), {
    replaceState: true,
  });
}

// The one "Find a match" sheet for the app and the Undo offer after it.
export class MatchStore {
  current = $state<LibraryEntry | null>(null);
  notice = $state<MatchNotice | null>(null);
  error = $state("");
  private pending: MatchNotice | null = null;
  private navigate: (entry: LibraryEntry) => void;

  constructor(navigate: (entry: LibraryEntry) => void = land) {
    this.navigate = navigate;
  }

  open(entry: LibraryEntry) {
    this.notice = null;
    this.error = "";
    this.pending = null;
    this.current = entry;
  }

  close() {
    this.current = null;
  }

  // Saved: close first; landing waits for `closed`, so the sheet's Back can't undo it.
  merged(into: LibraryEntry) {
    if (this.current) this.pending = { manual: this.current, into };
    this.current = null;
  }

  closed() {
    const done = this.pending;
    this.pending = null;
    if (!done) return;
    this.navigate(done.into);
    this.notice = done;
  }

  async undo(library: Unmerger) {
    const done = this.notice;
    this.notice = null;
    if (!done) return;
    const back = await library.unmerge(done.manual.key);
    if (back) this.navigate(back);
    else this.error = library.error || "Couldn't undo the match.";
  }

  dismiss() {
    this.notice = null;
    this.error = "";
  }
}

export const match = new MatchStore();
