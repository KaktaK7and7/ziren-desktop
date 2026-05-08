use once_cell::sync::Lazy;
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

static ASSISTANT_PROCESS: Lazy<Mutex<Option<Child>>> =
    Lazy::new(|| Mutex::new(None));

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn start_assistant_core() -> Result<(), String> {
    let mut process = ASSISTANT_PROCESS
        .lock()
        .map_err(|_| "Failed to lock assistant process")?;

    if process.is_some() {
        return Ok(());
    }

    #[cfg(debug_assertions)]
    let child = {
        let project_root =
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .and_then(|p| p.parent())
                .unwrap()
                .to_path_buf();

        let assistant_root =
            project_root.join("ziren_assistant_v2");

        let python_path = assistant_root
            .join(".venv")
            .join("Scripts")
            .join("python.exe");

        Command::new(python_path)
            .arg("-m")
            .arg("app.main")
            .current_dir(assistant_root)
            .spawn()
    };

    #[cfg(not(debug_assertions))]
    let child = Command::new("assistant-core.exe").spawn();

    match child {
        Ok(child) => {
            *process = Some(child);

            println!("✅ Assistant core started");

            Ok(())
        }

        Err(error) => {
            println!(
                "❌ Failed to start assistant core: {}",
                error
            );

            Err(error.to_string())
        }
    }
}

fn stop_assistant_core() {
    let mut process = ASSISTANT_PROCESS.lock().unwrap();

    if let Some(child) = process.as_mut() {
        let _ = child.kill();
        let _ = child.wait();

        println!("🛑 Assistant core stopped");
    }

    *process = None;
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
        let _ = window.set_position(
            tauri::PhysicalPosition::new(
                x as i32 - 240,
                y as i32 - 170,
            ),
        );

        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn exit_app(app: AppHandle) {
    stop_assistant_core();
    app.exit(0);
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
    exit_app(app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())

        .invoke_handler(tauri::generate_handler![
            greet,
            start_assistant_core,
            tray_open,
            tray_hide,
            tray_exit
        ])

        .setup(|app| {
            WebviewWindowBuilder::new(
                app,
                "tray-menu",
                WebviewUrl::App("/".into()),
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

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())

                .show_menu_on_left_click(false)

                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();

                        if let Some(window) =
                            app.get_webview_window("main")
                        {
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

                        show_tray_menu(
                            app,
                            position.x,
                            position.y,
                        );
                    }

                    _ => {}
                })

                .build(app)?;

            Ok(())
        })

        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();

                if window.label() == "main" {
                    let _ = window.emit("pause-ui", ());
                    let _ = window.hide();
                }

                if window.label() == "tray-menu" {
                    let _ = window.hide();
                }
            }

            WindowEvent::Focused(false) => {
                if window.label() == "tray-menu" {
                    let _ = window.hide();
                }
            }

            _ => {}
        })

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}