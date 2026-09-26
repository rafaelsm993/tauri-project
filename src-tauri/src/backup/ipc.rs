use super::apply::{apply, ImportMode, ImportReport};
use super::bundle::{Bundle, Limits};
use super::{default_name, export_to, load_bundle, with_zip_ext, ExportReport, ImportPreview};
use crate::library::commands::LibraryState;
use crate::library::posters;
use crate::prefs::ipc::PrefsState;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

const FILTER_NAME: &str = "Aevum backup";
const FILTER_EXT: &[&str] = &["zip"];
const DIALOG_GONE: &str = "the file dialog closed unexpectedly";

// The one parsed backup waiting for the user's merge-or-replace answer.
#[derive(Default)]
pub struct BackupState {
    pending: tokio::sync::Mutex<Option<Bundle>>,
}

fn to_path(picked: Option<FilePath>) -> Result<Option<PathBuf>, String> {
    picked
        .map(|p| {
            p.into_path()
                .map_err(|e| format!("this file location is not supported yet: {e}"))
        })
        .transpose()
}

async fn save_path(app: &AppHandle, name: String) -> Result<Option<PathBuf>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Export backup")
        .add_filter(FILTER_NAME, FILTER_EXT)
        .set_file_name(name)
        .save_file(move |p| {
            let _ = tx.send(p);
        });
    let picked = rx.await.map_err(|_| DIALOG_GONE.to_string())?;
    Ok(to_path(picked)?.map(with_zip_ext))
}

async fn open_path(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Import backup")
        .add_filter(FILTER_NAME, FILTER_EXT)
        .pick_file(move |p| {
            let _ = tx.send(p);
        });
    to_path(rx.await.map_err(|_| DIALOG_GONE.to_string())?)
}

#[tauri::command]
pub async fn backup_export(
    app: AppHandle,
    library: State<'_, LibraryState>,
    prefs: State<'_, PrefsState>,
    at: String,
) -> Result<Option<ExportReport>, String> {
    let Some(path) = save_path(&app, default_name(&at)).await? else {
        return Ok(None);
    };
    export_to(&path, &library, &prefs, &at).await.map(Some)
}

#[tauri::command]
pub async fn backup_pick_import(
    app: AppHandle,
    backup: State<'_, BackupState>,
) -> Result<Option<ImportPreview>, String> {
    let Some(path) = open_path(&app).await? else {
        return Ok(None);
    };
    let bundle = load_bundle(&path, &Limits::DEFAULT)?;
    let preview = ImportPreview::of(&bundle);
    *backup.pending.lock().await = Some(bundle);
    Ok(Some(preview))
}

// Replace keeps a copy of the current data next to library.json first.
#[tauri::command]
pub async fn backup_apply_import(
    library: State<'_, LibraryState>,
    prefs: State<'_, PrefsState>,
    backup: State<'_, BackupState>,
    mode: ImportMode,
) -> Result<ImportReport, String> {
    let bundle = backup
        .pending
        .lock()
        .await
        .take()
        .ok_or("Choose a backup file first.")?;
    if mode == ImportMode::Replace {
        let dir = library.events.parent().ok_or("no data folder")?;
        let at = bundle.manifest.created_at.clone();
        export_to(&dir.join("pre-import-backup.zip"), &library, &prefs, &at)
            .await
            .map_err(|e| format!("could not save a safety copy first, nothing was changed: {e}"))?;
    }
    let report = apply(&library, &prefs, bundle, mode).await?;
    posters::forget_failures(&library).await;
    tauri::async_runtime::spawn(posters::fill(library.inner().clone()));
    Ok(report)
}

#[tauri::command]
pub async fn backup_cancel_import(backup: State<'_, BackupState>) -> Result<(), String> {
    backup.pending.lock().await.take();
    Ok(())
}
