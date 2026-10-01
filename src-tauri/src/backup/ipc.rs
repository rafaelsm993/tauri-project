use super::apply::{import, ImportMode, ImportReport};
use super::bundle::{Bundle, Limits};
use super::{default_name, export_into, load_from, with_zip_ext, ExportReport, ImportPreview};
use crate::library::commands::LibraryState;
use crate::library::posters;
use crate::prefs::ipc::PrefsState;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_fs::FsExt;

const FILTER_NAME: &str = "Aevum backup";
const FILTER_EXT: &[&str] = &["zip"];
const DIALOG_GONE: &str = "the file dialog closed unexpectedly";

// The one parsed backup waiting for the user's merge-or-replace answer.
#[derive(Default)]
pub struct BackupState {
    pending: tokio::sync::Mutex<Option<Bundle>>,
}

// A document's name belongs to its provider; only a plain path gets the `.zip` added.
fn with_zip(picked: FilePath) -> FilePath {
    match picked {
        FilePath::Path(p) => FilePath::Path(with_zip_ext(p)),
        url => url,
    }
}

async fn save_target(app: &AppHandle, name: String) -> Result<Option<FilePath>, String> {
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
    Ok(picked.map(with_zip))
}

async fn open_target(app: &AppHandle) -> Result<Option<FilePath>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title("Import backup")
        .add_filter(FILTER_NAME, FILTER_EXT)
        .pick_file(move |p| {
            let _ = tx.send(p);
        });
    rx.await.map_err(|_| DIALOG_GONE.to_string())
}

#[tauri::command]
pub async fn backup_export(
    app: AppHandle,
    library: State<'_, LibraryState>,
    prefs: State<'_, PrefsState>,
    at: String,
) -> Result<Option<ExportReport>, String> {
    let Some(to) = save_target(&app, default_name(&at)).await? else {
        return Ok(None);
    };
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&cache).map_err(|e| format!("create {}: {e}", cache.display()))?;
    let staging = cache.join("export-staging.zip");
    export_into(app.fs(), &to, &staging, &library, &prefs, &at)
        .await
        .map(Some)
}

#[tauri::command]
pub async fn backup_pick_import(
    app: AppHandle,
    backup: State<'_, BackupState>,
) -> Result<Option<ImportPreview>, String> {
    let Some(from) = open_target(&app).await? else {
        return Ok(None);
    };
    let bundle = load_from(app.fs(), &from, &Limits::DEFAULT)?;
    let preview = ImportPreview::of(&bundle);
    *backup.pending.lock().await = Some(bundle);
    Ok(Some(preview))
}

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
    let report = import(&library, &prefs, bundle, mode).await?;
    posters::forget_failures(&library).await;
    tauri::async_runtime::spawn(posters::fill(library.inner().clone()));
    Ok(report)
}

#[tauri::command]
pub async fn backup_cancel_import(backup: State<'_, BackupState>) -> Result<(), String> {
    backup.pending.lock().await.take();
    Ok(())
}
