#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{Manager, window::Color};

    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_background_color(Some(Color(0, 0, 0, 0)))?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Naiwa Pet");
}
