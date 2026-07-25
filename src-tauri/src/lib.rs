use once_cell::sync::Lazy;
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};

struct AssistantProcess {
    child: Child,
    local_api_token: String,
}

static ASSISTANT_PROCESS: Lazy<Mutex<Option<AssistantProcess>>> = Lazy::new(|| Mutex::new(None));

const PRODUCTION_AUTH_SITE_URL: &str = "https://www.ziren.store";
const DEBUG_AUTH_SITE_URL_ENV: &str = "ZIREN_AUTH_SITE_URL";

fn get_auth_site_url() -> Result<String, String> {
    #[cfg(not(debug_assertions))]
    {
        Ok(PRODUCTION_AUTH_SITE_URL.to_string())
    }

    #[cfg(debug_assertions)]
    {
        let configured_url = std::env::var(DEBUG_AUTH_SITE_URL_ENV)
            .unwrap_or_else(|_| PRODUCTION_AUTH_SITE_URL.to_string());
        let normalized_url = configured_url.trim().trim_end_matches('/');
        let (scheme, authority) = normalized_url
            .split_once("://")
            .ok_or_else(|| format!("{DEBUG_AUTH_SITE_URL_ENV} must include a URL scheme"))?;
        let hostname = authority.split(':').next().unwrap_or_default();
        let is_local_http = scheme == "http" && matches!(hostname, "localhost" | "127.0.0.1");
        let is_https = scheme == "https";

        if authority.is_empty()
            || normalized_url.len() > 2048
            || (!is_https && !is_local_http)
            || normalized_url.contains('@')
            || authority.contains('/')
            || authority.contains('?')
            || authority.contains('#')
            || normalized_url.chars().any(char::is_whitespace)
        {
            return Err(format!(
                "{DEBUG_AUTH_SITE_URL_ENV} must be an HTTPS origin or local HTTP origin"
            ));
        }

        Ok(normalized_url.to_string())
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn start_assistant_core(desktop_token: String, local_api_token: String) -> Result<(), String> {
    let desktop_token = desktop_token.trim();
    let local_api_token = local_api_token.trim();
    let auth_site_url = get_auth_site_url()?;

    if desktop_token.is_empty() || desktop_token.len() > 512 {
        return Err("Invalid desktop authorization token".to_string());
    }

    if local_api_token.len() < 32 || local_api_token.len() > 512 {
        return Err("Invalid local API token".to_string());
    }

    let mut process = ASSISTANT_PROCESS
        .lock()
        .map_err(|_| "Failed to lock assistant process")?;

    if let Some(current) = process.as_mut() {
        match current.child.try_wait() {
            Ok(None) if current.local_api_token == local_api_token => return Ok(()),
            Ok(None) => {
                let _ = current.child.kill();
                let _ = current.child.wait();
                *process = None;
            }
            Ok(Some(_)) | Err(_) => *process = None,
        }
    }

    #[cfg(debug_assertions)]
    let child = {
        let project_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(|p| p.parent())
            .unwrap()
            .to_path_buf();

        let assistant_root = ["ziren_assistant_v2", "ziren-assistant-v2"]
            .iter()
            .map(|folder| project_root.join(folder))
            .find(|path| path.exists())
            .ok_or_else(|| "Assistant core source directory not found".to_string())?;

        let python_path = assistant_root
            .join(".venv")
            .join("Scripts")
            .join("python.exe");

        Command::new(python_path)
            .arg("-m")
            .arg("app.main")
            .current_dir(assistant_root)
            .env("AUTH_SITE_URL", &auth_site_url)
            .env("ZIREN_DESKTOP_TOKEN", desktop_token)
            .env("ZIREN_LOCAL_API_TOKEN", local_api_token)
            .spawn()
    };

    #[cfg(not(debug_assertions))]
    let child = Command::new("assistant-core.exe")
        .env("AUTH_SITE_URL", &auth_site_url)
        .env("ZIREN_DESKTOP_TOKEN", desktop_token)
        .env("ZIREN_LOCAL_API_TOKEN", local_api_token)
        .spawn();

    match child {
        Ok(child) => {
            *process = Some(AssistantProcess {
                child,
                local_api_token: local_api_token.to_string(),
            });

            println!("✅ Assistant core started");

            Ok(())
        }

        Err(error) => {
            println!("❌ Failed to start assistant core: {}", error);

            Err(error.to_string())
        }
    }
}

fn stop_assistant_core_process() -> Result<(), String> {
    let mut process = ASSISTANT_PROCESS
        .lock()
        .map_err(|_| "Failed to lock assistant process")?;

    if let Some(current) = process.as_mut() {
        let _ = current.child.kill();
        let _ = current.child.wait();

        println!("🛑 Assistant core stopped");
    }

    *process = None;

    Ok(())
}

#[tauri::command]
fn stop_assistant_core() -> Result<(), String> {
    stop_assistant_core_process()
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

fn fit_screen_overlay_to_primary_monitor(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("screen-overlay")
        .ok_or_else(|| "screen-overlay window not found".to_string())?;

    let monitor = app
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "primary monitor not found".to_string())?;

    let position = monitor.position();
    let size = monitor.size();

    window
        .set_position(PhysicalPosition::new(position.x - 8, position.y - 8))
        .map_err(|error| error.to_string())?;
    window
        .set_size(PhysicalSize::new(size.width + 16, size.height + 16))
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn show_listening_overlay(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("screen-overlay")
        .ok_or_else(|| "screen-overlay window not found".to_string())?;

    let _ = fit_screen_overlay_to_primary_monitor(&app);

    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_focusable(false);

    // Форсим пересоздание topmost слоя Windows
    let _ = window.hide();

    std::thread::sleep(std::time::Duration::from_millis(16));

    window.show().map_err(|error| error.to_string())?;

    let _ = window.unminimize();

    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn hide_listening_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("screen-overlay") {
        let _ = window.set_always_on_top(false);

        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn show_tray_menu(app: &AppHandle, x: f64, y: f64) {
    if let Some(window) = app.get_webview_window("tray-menu") {
        let _ = window.set_position(tauri::PhysicalPosition::new(x as i32 - 240, y as i32 - 170));

        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn exit_app(app: AppHandle) {
    let _ = stop_assistant_core_process();
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
fn tray_menu_hide(app: AppHandle) {
    hide_tray_menu(&app);
}

#[tauri::command]
fn tray_exit(app: AppHandle) {
    exit_app(app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_assistant_core,
            stop_assistant_core,
            tray_open,
            tray_hide,
            tray_menu_hide,
            tray_exit,
            show_listening_overlay,
            hide_listening_overlay
        ])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "tray-menu", WebviewUrl::App("/".into()))
                .title("Ziren Tray Menu")
                .inner_size(230.0, 160.0)
                .decorations(false)
                .resizable(false)
                .visible(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .build()?;

            let overlay =
                WebviewWindowBuilder::new(app, "screen-overlay", WebviewUrl::App("/".into()))
                    .title("Ziren Listening Overlay")
                    .inner_size(800.0, 600.0)
                    .decorations(false)
                    .resizable(false)
                    .visible(false)
                    .transparent(true)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .focused(false)
                    .focusable(false)
                    .build()?;

            let _ = overlay.set_ignore_cursor_events(true);
            let _ = fit_screen_overlay_to_primary_monitor(app.handle());

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
