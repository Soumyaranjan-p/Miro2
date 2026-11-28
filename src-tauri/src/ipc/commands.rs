use tauri::{AppHandle, State};

use crate::app::notch::NotchRuntime;
use crate::usage::{store, UsageRuntime};

use super::types::{default_snapshot, AppSnapshot, NotchState, UsageSettings};

#[tauri::command]
pub fn notch_state(runtime: State<'_, NotchRuntime>) -> NotchState {
    NotchState {
        phase: runtime.phase(),
    }
}

/// The frontend's first read. Everything the app does not persist yet comes
/// back as a sensible empty state rather than demo data.
#[tauri::command]
pub fn app_snapshot(runtime: State<'_, NotchRuntime>) -> AppSnapshot {
    default_snapshot(runtime.phase())
}

#[tauri::command]
pub fn usage_settings_get(runtime: State<'_, UsageRuntime>) -> UsageSettings {
    runtime.settings.lock().expect("settings mutex").clone()
}

#[tauri::command]
pub fn usage_settings_set(
    app: AppHandle,
    runtime: State<'_, UsageRuntime>,
    settings: UsageSettings,
) -> Result<(), String> {
    store::save(&app, &settings)?;
    *runtime.settings.lock().expect("settings mutex") = settings;
    Ok(())
}
