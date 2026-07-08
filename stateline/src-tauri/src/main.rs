// Stateline desktop shell. The game itself is the web build in ../dist; this
// wrapper gives it a native window, file-system saves, and a Steam-ready binary.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Stateline");
}
