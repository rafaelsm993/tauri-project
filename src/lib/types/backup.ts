// Mirror of the backup DTOs in src-tauri/src/backup/; guarded by backup.contract.test.ts.
export type ImportMode = "replace" | "merge";

export interface ExportReport {
  path: string;
  entries: number;
  posters: number;
  bytes: number;
}

export interface ImportPreview {
  created_at: string;
  app_version: string;
  entries: number;
  events: number;
  posters: number;
}

export interface ImportReport {
  added: number;
  updated: number;
  kept: number;
  removed: number;
  posters: number;
  prefs_restored: boolean;
}
