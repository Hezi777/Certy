mod ai;
mod certs;
mod checks;
mod commands;
mod crypto;
mod db;
mod model;
mod scheduler;

use commands::AppState;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Certy", true, None::<&str>)?;
    let check = MenuItem::with_id(app, "check", "Check all now", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &check, &quit])?;
    let mut builder = TrayIconBuilder::with_id("certy")
        .tooltip("Certy")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "check" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let ids: Vec<String> = app
                        .state::<AppState>()
                        .db
                        .lock()
                        .unwrap()
                        .items()
                        .unwrap_or_default()
                        .into_iter()
                        .map(|i| i.id)
                        .collect();
                    for id in ids {
                        let _ = commands::run_check(&app, &id).await;
                    }
                });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // must be first: a second launch just brings the running window forward
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db = db::Db::open(&dir.join("certy.db"))?;
            let vault = crypto::Vault::open()?;
            app.manage(AppState { db: Mutex::new(db), vault });

            tray(app)?;
            // started by autostart: stay in the tray
            if std::env::args().any(|a| a == "--hidden") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            scheduler::start(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // closing the window keeps Certy running in the tray so reminders still fire
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::load,
            commands::save_item,
            commands::delete_item,
            commands::save_service,
            commands::delete_service,
            commands::save_settings,
            commands::check_item,
            commands::parse_cert,
            commands::reveal_secret,
            commands::export_file,
            commands::save_ai_key,
            commands::ai_models,
            commands::ai_chat,
            commands::test_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Certy");
}
