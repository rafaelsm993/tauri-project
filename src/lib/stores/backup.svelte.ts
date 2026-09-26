import { backup as defaultClient, type BackupClient } from "$lib/api/backup";
import { libraryStore } from "./library.svelte";
import { prefsStore } from "./prefs.svelte";
import type { ImportMode, ImportPreview, ImportReport } from "$lib/types/backup";
import { errorMessage } from "$lib/utils/errors";

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function importSummary(report: ImportReport, mode: ImportMode): string {
  if (mode === "merge") {
    return `Merged: ${report.added} new, ${report.updated} updated, ${report.kept} kept.`;
  }
  const settings = report.prefs_restored ? " Settings restored." : "";
  return `Library replaced with ${count(report.added + report.updated, "item")}.${settings}`;
}

type Reload = (mode: ImportMode) => Promise<void>;

async function reloadStores(mode: ImportMode): Promise<void> {
  await libraryStore.reload();
  if (mode === "replace") await prefsStore.reload();
}

// Export, and import in two steps: pick a file, then merge or replace.
export class BackupStore {
  private client: BackupClient;
  private reload: Reload;

  busy = $state(false);
  preview = $state<ImportPreview | null>(null);
  message = $state("");
  error = $state("");

  constructor(client: BackupClient = defaultClient, reload: Reload = reloadStores) {
    this.client = client;
    this.reload = reload;
  }

  exportNow(): Promise<void> {
    return this.run(async () => {
      const r = await this.client.exportBackup();
      if (r) {
        this.message = `Saved ${count(r.entries, "item")} and ${count(r.posters, "poster")} to ${r.path}.`;
      }
    }, "Export failed.");
  }

  pickImport(): Promise<void> {
    return this.run(async () => {
      this.preview = await this.client.pickImport();
    }, "Could not read that backup.");
  }

  apply(mode: ImportMode): Promise<void> {
    return this.run(async () => {
      this.preview = null;
      const report = await this.client.applyImport(mode);
      await this.reload(mode);
      this.message = importSummary(report, mode);
    }, "Import failed.");
  }

  async cancel(): Promise<void> {
    this.preview = null;
    await this.client.cancelImport().catch(() => {});
  }

  private async run(task: () => Promise<void>, fallback: string): Promise<void> {
    this.busy = true;
    this.message = "";
    this.error = "";
    try {
      await task();
    } catch (e) {
      this.error = errorMessage(e, fallback);
    } finally {
      this.busy = false;
    }
  }
}

export const backupStore = new BackupStore();
