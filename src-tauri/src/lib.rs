pub mod api;
pub mod library;
pub mod logging;
pub mod store;

use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

/// Dev-only opt-in (`TAURI_APP_DEVTOOLS=1`) since a docked inspector costs viewport and CPU.
#[cfg(all(desktop, debug_assertions))]
fn devtools_requested(value: Option<&str>) -> bool {
    value.is_some_and(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
}

/// Rust logs go to terminal/logcat and a rotating file, deliberately not the devtools console.
fn log_targets() -> Vec<Target> {
    vec![
        Target::new(TargetKind::Stdout),
        Target::new(TargetKind::LogDir { file_name: None }),
    ]
}

fn log_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let level = logging::level_from_env(
        std::env::var("TAURI_APP_LOG").ok().as_deref(),
        logging::default_level(cfg!(debug_assertions)),
    );
    let mut builder = tauri_plugin_log::Builder::new()
        .level(level)
        .targets(log_targets())
        .max_file_size(5_000_000)
        .rotation_strategy(RotationStrategy::KeepSome(3))
        .timezone_strategy(TimezoneStrategy::UseLocal);
    for krate in logging::NOISY_CRATES {
        builder = builder.level_for(*krate, logging::noisy_crate_level(level));
    }
    builder.build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(log_plugin())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            let dir = _app
                .path()
                .app_data_dir()
                .map_err(|e| format!("no app data dir: {e}"))?;
            _app.manage(library::ipc::init(&dir)?);

            #[cfg(all(desktop, debug_assertions))]
            if devtools_requested(std::env::var("TAURI_APP_DEVTOOLS").ok().as_deref()) {
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::catalog::catalog_genres,
            api::catalog::catalog_page,
            api::catalog::catalog_detail,
            library::ipc::library_load,
            library::ipc::library_add,
            library::ipc::library_update,
            library::ipc::library_remove,
            library::ipc::library_poster_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(all(test, desktop, debug_assertions))]
mod tests {
    use super::devtools_requested;

    #[test]
    fn devtools_off_when_unset_or_empty() {
        assert!(!devtools_requested(None));
        assert!(!devtools_requested(Some("")));
        assert!(!devtools_requested(Some("0")));
        assert!(!devtools_requested(Some("false")));
    }

    #[test]
    fn devtools_on_for_truthy_values() {
        assert!(devtools_requested(Some("1")));
        assert!(devtools_requested(Some("true")));
        assert!(devtools_requested(Some(" YES ")));
    }
}
