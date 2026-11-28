//! Settings for the usage dock, persisted as JSON next to the app's data
//! dir. Only overrides live here — token numbers always come from the
//! providers' own local data.

use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::ipc::types::UsageSettings;

pub fn settings_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("usage-settings.json"))
}

pub fn load(app: &tauri::AppHandle) -> UsageSettings {
    let Some(path) = settings_path(app) else {
        return UsageSettings::default();
    };

    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn save(app: &tauri::AppHandle, settings: &UsageSettings) -> Result<(), String> {
    let Some(path) = settings_path(app) else {
        return Err(String::from("no app data dir"));
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    // Write-then-rename: a crash mid-write must not lose the settings.
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(&tmp, text).map_err(|error| error.to_string())?;
    fs::rename(&tmp, &path).map_err(|error| error.to_string())?;
    Ok(())
}
