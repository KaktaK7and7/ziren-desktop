use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Emitter, Manager, WindowEvent,
};

// --- Команда (оставляем как есть) ---
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// --- Показ окна ---
fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("resume-ui", ());
    }
}

// --- Скрытие окна ---
fn hide_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("pause-ui", ());
        let _ = window.hide();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])

        // --- SETUP: создаем трей ---
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Открыть", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Скрыть", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&open, &hide, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)

                // --- Клики по меню ---
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_window(app),
                    "hide" => hide_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })

                // --- Клик по иконке ---
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();

                        if let Some(window) = app.get_webview_window("main") {
                            match window.is_visible() {
                                Ok(true) => hide_window(app),
                                _ => show_window(app),
                            }
                        }
                    }
                })

                .build(app)?;

            Ok(())
        })

        // --- Перехват крестика ---
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("pause-ui", ());
                let _ = window.hide();
            }
        })

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}