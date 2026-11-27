mod app;
mod ipc;
mod media;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(app::notch::NotchRuntime::default())
        .invoke_handler(tauri::generate_handler![
            ipc::commands::notch_state,
            ipc::commands::app_snapshot
        ])
        .setup(|app| {
            app::notch::spawn(app.handle().clone());
            media::spawn(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Miro");
}
