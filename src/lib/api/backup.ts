import { invoke } from "@tauri-apps/api/core";
import type { ExportReport, ImportMode, ImportPreview, ImportReport } from "$lib/types/backup";

// null means the user closed the file dialog.
function exportBackup(): Promise<ExportReport | null> {
  return invoke<ExportReport | null>("backup_export", { at: new Date().toISOString() });
}

function pickImport(): Promise<ImportPreview | null> {
  return invoke<ImportPreview | null>("backup_pick_import");
}

function applyImport(mode: ImportMode): Promise<ImportReport> {
  return invoke<ImportReport>("backup_apply_import", { mode });
}

function cancelImport(): Promise<void> {
  return invoke<void>("backup_cancel_import");
}

export const backup = { exportBackup, pickImport, applyImport, cancelImport };
export type BackupClient = typeof backup;
