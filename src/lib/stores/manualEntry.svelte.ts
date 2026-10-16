import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { detailPath } from "$lib/domain/libraryView";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaKey, MediaType } from "$lib/types/media";

// What happens after Save: open the new item, or stay and offer it in a notice.
export type After = "open" | "stay";

export interface ManualEntryOptions {
  type?: MediaType;
  title?: string;
  // The key of a manual item to edit instead of adding one.
  edit?: MediaKey | null;
  after?: After;
}

export interface ManualEntryRequest {
  type: MediaType;
  title: string;
  edit: MediaKey | null;
  after: After;
}

function openItem(entry: LibraryEntry) {
  const path = detailPath(entry);
  void goto(resolve("/media/[type]/[id]", { type: path.type, id: encodeURIComponent(path.id) }));
}

// The one add/edit sheet for the whole app; any button opens it, the root layout shows it.
export class ManualEntryStore {
  current = $state<ManualEntryRequest | null>(null);
  notice = $state<LibraryEntry | null>(null);

  private pending: LibraryEntry | null = null;
  private navigate: (entry: LibraryEntry) => void;

  constructor(navigate: (entry: LibraryEntry) => void = openItem) {
    this.navigate = navigate;
  }

  open(options: ManualEntryOptions = {}) {
    const edit = options.edit ?? null;
    this.notice = null;
    this.pending = null;
    this.current = {
      type: options.type ?? "movie",
      title: options.title ?? "",
      edit,
      after: options.after ?? (edit ? "stay" : "open"),
    };
  }

  close() {
    this.current = null;
  }

  // The form saved: close first; any navigation waits for `closed`.
  saved(entry: LibraryEntry) {
    const request = this.current;
    this.current = null;
    if (!request || request.edit) return;
    if (request.after === "open") this.pending = entry;
    else this.notice = entry;
  }

  // The duplicate prompt's "Open it": same order as a save.
  openExisting(entry: LibraryEntry) {
    this.current = null;
    this.pending = entry;
  }

  // The sheet's history entry is gone; only now can navigating not be undone by it.
  closed() {
    const entry = this.pending;
    this.pending = null;
    if (entry) this.navigate(entry);
  }

  openNotice() {
    const entry = this.notice;
    this.notice = null;
    if (entry) this.navigate(entry);
  }

  dismissNotice() {
    this.notice = null;
  }
}

export const manualEntry = new ManualEntryStore();
