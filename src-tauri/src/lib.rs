use tauri::Manager;

mod app;
mod bluetooth;
mod ipc;
mod media;
mod power;
mod system;
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
            ipc::commands::media_control,
            ipc::commands::usage_settings_get,
            ipc::commands::usage_settings_set
        ])
        .setup(|app| {
            let (tx, rx) = std::sync::mpsc::channel::<media::MediaCommand>();
            app.manage(media::MediaRuntime::new(tx));
            app::notch::spawn(app.handle().clone());
            media::spawn(app.handle().clone(), rx);
            usage::spawn(app.handle().clone());
            system::spawn(app.handle().clone());
            power::spawn(app.handle().clone());
            bluetooth::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Miro");
}
