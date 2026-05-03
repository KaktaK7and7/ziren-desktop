use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("resume-ui", ());
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("pause-ui", ());
        let _ = window.hide();
    }
}

fn hide_tray_menu(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("tray-menu") {
        let _ = window.hide();
    }
}

fn show_tray_menu(app: &AppHandle, x: f64, y: f64) {
    if let Some(window) = app.get_webview_window("tray-menu") {
        let _ = window.set_position(tauri::PhysicalPosition::new(x as i32 - 240, y as i32 - 170));
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn tray_open(app: AppHandle) {
    hide_tray_menu(&app);
    show_main_window(&app);
}

#[tauri::command]
fn tray_hide(app: AppHandle) {
    hide_tray_menu(&app);
    hide_main_window(&app);
}

#[tauri::command]
fn tray_exit(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            tray_open,
            tray_hide,
            tray_exit
        ])
        .setup(|app| {
            WebviewWindowBuilder::new(
                app,
                "tray-menu",
                WebviewUrl::App("index.html".into()),
            )
            .title("Ziren Tray Menu")
            .inner_size(230.0, 160.0)
            .decorations(false)
            .resizable(false)
            .visible(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .build()?;

            let open = MenuItem::with_id(app, "open", "Открыть", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Скрыть", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &hide, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "hide" => hide_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();

                        if let Some(window) = app.get_webview_window("main") {
                            match window.is_visible() {
                                Ok(true) => hide_main_window(app),
                                _ => show_main_window(app),
                            }
                        }
                    }

                    TrayIconEvent::Click {
                        button: MouseButton::Right,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } => {
                        let app = tray.app_handle();
                        show_tray_menu(app, position.x, position.y);
                    }

                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();

                    if window.label() == "main" {
                        let _ = window.emit("pause-ui", ());
                        let _ = window.hide();
                    } else if window.label() == "tray-menu" {
                        let _ = window.hide();
                    }
                }

                WindowEvent::Focused(false) => {
                    if window.label() == "tray-menu" {
                        let _ = window.hide();
                    }
                }

                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}