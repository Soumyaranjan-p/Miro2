mod app;
mod ipc;
mod media;
mod usage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(app::notch::NotchRuntime::default())
        .manage(usage::UsageRuntime::default())
        .invoke_handler(tauri::generate_handler![
            ipc::commands::notch_state,
            ipc::commands::app_snapshot,
            ipc::commands::usage_settings_get,
            ipc::commands::usage_settings_set
        ])
        .setup(|app| {
            app::notch::spawn(app.handle().clone());
            media::spawn(app.handle().clone());
            usage::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Miro");
}
